import pandas as pd
from collections import OrderedDict

def merge_data(*dicts):
    merged = OrderedDict()
    for d in dicts:
        merged.update(d)

    return merged

def write_to_excel(file_path, new_data_dict):
    import pandas as pd

    header_df = pd.read_excel(file_path, header=None, nrows=2)
    header_1 = header_df.iloc[0].fillna("")
    header_2 = header_df.iloc[1].fillna("")

    combined_headers = [
        f"{str(h1).strip()} - {str(h2).strip()}" if str(h1).strip() else str(h2).strip()
        for h1, h2 in zip(header_1, header_2)
    ]

    data_df = pd.read_excel(file_path, header=None, skiprows=2)
    data_df.columns = combined_headers

    # 🔒 Eğer dict None veya boşsa, sadece boş satır oluştur
    new_data_dict = new_data_dict or {}

    new_row = {col: new_data_dict.get(col, None) for col in combined_headers}
    data_df = pd.concat([data_df, pd.DataFrame([new_row])], ignore_index=True)

    full_df = pd.concat([
        pd.DataFrame([header_1]),
        pd.DataFrame([header_2]),
        data_df
    ], ignore_index=True)

    full_df.to_excel(file_path, index=False, header=False)
