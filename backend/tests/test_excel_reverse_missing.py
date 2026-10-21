import io
import pandas as pd
from backend.excel_compare import compare_excel_workbook


def circle(building, number):
    return {'building_name': building, 'matched_text': {'text': str(number)},
            'center_x': 20., 'center_y': 10., 'manual_match': True}


def compare(sheets, circles, mode='sheet'):
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        for name, rows in sheets.items():
            pd.DataFrame(rows, columns=['building', 'number', 'X', 'Y']).to_excel(writer, sheet_name=name, index=False)
    return compare_excel_workbook(buffer.getvalue(), sheet_names=list(sheets), header_row=1,
        building_column='A' if mode == 'column' else None, number_column='B', x_column='C', y_column='D',
        building_source_mode=mode, circles_a=circles, circles_b=circles)


def test_manual_piles_missing_from_excel_are_reported_once_and_unselected_buildings_are_excluded():
    circles = [circle('101동', n) for n in (465,466,467)] + [circle('102동',1)]
    result = compare({'101동': [['101동',465,10,20]]}, circles)
    assert result['summary']['missingExcel'] == 2
    assert {(i['buildingName'], i['number']) for i in result['issues']} == {('101동','466'),('101동','467')}
    assert result['sheetSummaries'][0]['summary']['missingExcel'] == 2
    assert all(i['excelRow'] is None and i['excelX'] is None for i in result['issues'])


def test_same_building_across_sheets_and_invalid_coordinates_do_not_create_false_absence():
    result = compare({'Part1': [['101동',1,10,20]], 'Part2': [['101동',2,None,20]]},
        [circle('101동',1),circle('101동',2)], 'column')
    assert result['summary']['missingExcel'] == 0
    assert result['summary']['skippedRows'] == 1


def test_building_number_aliases_and_single_parking_alias_are_present():
    result = compare({'101동': [['101동','101-466',10,20]], '주차장': [['',1,10,20]]},
        [circle('101동',466),circle('B1',1)])
    assert result['summary']['missingExcel'] == 0


def test_empty_selected_building_sheet_still_reports_its_drawing_numbers():
    result = compare({'101동': []}, [circle('101동',466)])
    assert result['summary']['missingExcel'] == 1
