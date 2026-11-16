# Closing this job handle also closes the backend's descendants when Task
# Scheduler stops the watchdog, even when PowerShell cannot run its finally.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
namespace PileXY {
    public sealed class WatchdogJob : IDisposable {
        [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
            public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass, SchedulingClass;
        }
        [StructLayout(LayoutKind.Sequential)] struct IoCounters {
            public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
            public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
        }
        [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
            public BasicLimits BasicLimitInformation;
            public IoCounters IoInfo;
            public UIntPtr ProcessMemoryLimit, JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed, PeakJobMemoryUsed;
        }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern IntPtr CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetInformationJobObject(IntPtr job, int infoClass,
            ref ExtendedLimits info, uint length);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
        [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
        [StructLayout(LayoutKind.Sequential)] struct SecurityAttributes {
            public int Length;
            public IntPtr SecurityDescriptor;
            public int InheritHandle;
        }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo {
            public int Size;
            public string Reserved, Desktop, Title;
            public uint X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags;
            public short ShowWindow, ReservedSize;
            public IntPtr ReservedBytes, StdInput, StdOutput, StdError;
        }
        [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
            public IntPtr Process, Thread;
            public uint ProcessId, ThreadId;
        }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern IntPtr CreateFile(string path, uint access, uint share,
            ref SecurityAttributes security, uint creation, uint flags, IntPtr template);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool CreateProcess(string executable, StringBuilder commandLine,
            IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles,
            uint flags, IntPtr environment, string directory, ref StartupInfo startup,
            out ProcessInfo process);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process, uint code);
        IntPtr handle;
        public WatchdogJob() {
            handle = CreateJobObject(IntPtr.Zero, null);
            if (handle == IntPtr.Zero) throw new Win32Exception();
            var limits = new ExtendedLimits();
            limits.BasicLimitInformation.LimitFlags = 0x00002000; // KILL_ON_JOB_CLOSE
            if (!SetInformationJobObject(handle, 9, ref limits,
                    (uint)Marshal.SizeOf(typeof(ExtendedLimits)))) {
                int error = Marshal.GetLastWin32Error();
                Dispose();
                throw new Win32Exception(error);
            }
        }
        public void Add(Process process) {
            if (!AssignProcessToJobObject(handle, process.Handle)) throw new Win32Exception();
        }
        public bool Contains(int processId) {
            using (var process = Process.GetProcessById(processId)) {
                bool result;
                if (!IsProcessInJob(process.Handle, handle, out result)) throw new Win32Exception();
                return result;
            }
        }
        public Process StartHidden(string executable, string arguments, string directory,
                string stdoutPath, string stderrPath) {
            var security = new SecurityAttributes();
            security.Length = Marshal.SizeOf(typeof(SecurityAttributes));
            security.InheritHandle = 1;
            IntPtr input = new IntPtr(-1), output = new IntPtr(-1), error = new IntPtr(-1);
            var created = new ProcessInfo();
            bool resumed = false;
            try {
                input = CreateFile("NUL", 0x80000000, 3, ref security, 3, 0x80, IntPtr.Zero);
                output = CreateFile(stdoutPath, 0x40000000, 3, ref security, 2, 0x80, IntPtr.Zero);
                error = CreateFile(stderrPath, 0x40000000, 3, ref security, 2, 0x80, IntPtr.Zero);
                if (input == new IntPtr(-1) || output == new IntPtr(-1) || error == new IntPtr(-1))
                    throw new Win32Exception();
                var startup = new StartupInfo();
                startup.Size = Marshal.SizeOf(typeof(StartupInfo));
                startup.Flags = 0x101; // USESTDHANDLES | USESHOWWINDOW (hidden)
                startup.StdInput = input; startup.StdOutput = output; startup.StdError = error;
                var command = new StringBuilder("\"" + executable + "\" " + arguments);
                // The venv python.exe redirects to a second Python process. It
                // must inherit our job at creation, before any child can run.
                if (!CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true,
                        0x08000004, IntPtr.Zero, directory, ref startup, out created))
                    throw new Win32Exception();
                if (!AssignProcessToJobObject(handle, created.Process)) throw new Win32Exception();
                var process = Process.GetProcessById((int)created.ProcessId);
                // Cache a process handle before it can exit, preserving ExitCode
                // even when Python fails immediately after being resumed.
                if (process.Handle == IntPtr.Zero) {
                    process.Dispose();
                    throw new InvalidOperationException("Could not open the owned process handle.");
                }
                if (ResumeThread(created.Thread) == 0xffffffff) {
                    process.Dispose();
                    throw new Win32Exception();
                }
                resumed = true;
                return process;
            }
            finally {
                if (!resumed && created.Process != IntPtr.Zero) TerminateProcess(created.Process, 1);
                if (created.Thread != IntPtr.Zero) CloseHandle(created.Thread);
                if (created.Process != IntPtr.Zero) CloseHandle(created.Process);
                if (input != new IntPtr(-1)) CloseHandle(input);
                if (output != new IntPtr(-1)) CloseHandle(output);
                if (error != new IntPtr(-1)) CloseHandle(error);
            }
        }
        public void Dispose() {
            if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; }
        }
    }
}
'@


