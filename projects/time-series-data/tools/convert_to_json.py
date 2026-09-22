#!/usr/bin/env python3
"""将 CSV/XLS 原始数据转换为前端可用的 JSON（运行数据按小时预聚合以减小体积）。"""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
OUT = DATA / 'json'
OUT.mkdir(parents=True, exist_ok=True)


def round_nums(records, digits=3):
    for row in records:
        for k, v in list(row.items()):
            if isinstance(v, float):
                if np.isnan(v):
                    row[k] = None
                else:
                    row[k] = round(v, digits)
    return records


def write_json(name, payload):
    path = OUT / name
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = path.stat().st_size / (1024 * 1024)
    print(f'  wrote {name}: {size_mb:.2f} MB')


def convert_operation():
    print('converting operation...')
    df = pd.read_csv(DATA / '500KV_运行数据_2024-2025年.csv')
    df['t'] = pd.to_datetime(df['产生时间（15秒）'], errors='coerce')
    df = df.dropna(subset=['t'])
    # 按小时聚合，显著减小体积且满足小时/天/周/月粒度
    df['t'] = df['t'].dt.floor('h')
    agg = (
        df.groupby(['变压器资产ID', '相别', 't'], as_index=False)
        .agg({
            '有功电流（A）': 'mean',
            '有功功率（MW）': 'mean',
            '无功功率（MW）': 'mean',
            '负载率（%）': 'mean',
            '功率因数': 'mean',
            '开关档位': 'mean',
        })
    )
    records = []
    for _, r in agg.iterrows():
        records.append({
            'd': r['变压器资产ID'],
            't': r['t'].strftime('%Y-%m-%d %H:%M:%S'),
            'p': r['相别'],
            'i': float(r['有功电流（A）']),
            'ap': float(r['有功功率（MW）']),
            'rp': float(r['无功功率（MW）']),
            'lr': float(r['负载率（%）']),
            'pf': float(r['功率因数']),
            'tap': float(r['开关档位']) if pd.notna(r['开关档位']) else None,
        })
    write_json('operation.json', {'records': round_nums(records)})


def convert_oil_temp():
    print('converting oil_temp...')
    df = pd.read_csv(DATA / '变压器油温数据_2024-2025年.csv')
    df['t'] = pd.to_datetime(df['产生时间（yyyy-MM-dd HH:mm:ss）'], errors='coerce')
    df = df.dropna(subset=['t'])
    records = [{
        'd': r['变压器资产ID'],
        't': r['t'].strftime('%Y-%m-%d %H:%M:%S'),
        'p1': float(r['油温点位1（℃）']),
        'p2': float(r['油温点位2（℃）']),
    } for _, r in df.iterrows()]
    write_json('oil_temp.json', {'records': round_nums(records)})


def convert_oil_level():
    print('converting oil_level...')
    df = pd.read_csv(DATA / '变压器油位数据_2024-2025年.csv')
    df['t'] = pd.to_datetime(df['产生时间（yyyy-MM-dd HH:mm:ss）'], errors='coerce')
    df = df.dropna(subset=['t'])
    records = [{
        'd': r['变压器资产ID'],
        't': r['t'].strftime('%Y-%m-%d %H:%M:%S'),
        'lv': float(r['油位']),
    } for _, r in df.iterrows()]
    write_json('oil_level.json', {'records': round_nums(records)})


def convert_winding():
    print('converting winding_temp...')
    df = pd.read_csv(DATA / '变压器绕组温度数据_2024-2025年.csv')
    df['t'] = pd.to_datetime(df['产生时间（yyyy-MM-dd HH:mm:ss）'], errors='coerce')
    df = df.dropna(subset=['t'])
    records = [{
        'd': r['变压器资产ID'],
        't': r['t'].strftime('%Y-%m-%d %H:%M:%S'),
        'wt': float(r['绕组温度（℃）']),
    } for _, r in df.iterrows()]
    write_json('winding_temp.json', {'records': round_nums(records)})


def convert_chromatography():
    print('converting chromatography...')
    df = pd.read_csv(DATA / '变压器油色谱数据_三相_2024-2025年.csv')
    df['t'] = pd.to_datetime(df['数据时间'], errors='coerce')
    df = df.dropna(subset=['t'])
    records = []
    for _, r in df.iterrows():
        records.append({
            'd': r['变压器资产ID'],
            'ph': r['相位'],
            't': r['t'].strftime('%Y-%m-%d %H:%M:%S'),
            'h2': float(r['氢气(μL/L)']) if pd.notna(r['氢气(μL/L)']) else None,
            'ch4': float(r['甲烷(μL/L)']) if pd.notna(r['甲烷(μL/L)']) else None,
            'c2h6': float(r['乙烷(μL/L)']) if pd.notna(r['乙烷(μL/L)']) else None,
            'c2h4': float(r['乙烯(μL/L)']) if pd.notna(r['乙烯(μL/L)']) else None,
            'c2h2': float(r['乙炔(μL/L)']) if pd.notna(r['乙炔(μL/L)']) else None,
            'co': float(r['一氧化碳(μL/L)']) if pd.notna(r['一氧化碳(μL/L)']) else None,
            'co2': float(r['二氧化碳(μL/L)']) if pd.notna(r['二氧化碳(μL/L)']) else None,
            'thc': float(r['总烃(μL/L)']) if pd.notna(r['总烃(μL/L)']) else None,
        })
    write_json('chromatography.json', {'records': round_nums(records)})


def convert_weather():
    print('converting weather...')
    frames = []
    for name in ['24.xls', '25.xls']:
        path = DATA / name
        if not path.exists():
            continue
        df = pd.read_excel(path)
        df['utc'] = pd.to_datetime(df['世界时(UTC)'], errors='coerce')
        df['bj'] = pd.to_datetime(df['北京时(UTC+8)'], errors='coerce')
        df = df.dropna(subset=['utc'])
        df['ws'] = np.sqrt(df['经向风速(V,m/s)'] ** 2 + df['纬向风速(U,m/s)'] ** 2)
        frames.append(df)
    weather = pd.concat(frames, ignore_index=True)
    records = []
    for _, r in weather.iterrows():
        records.append({
            't': r['utc'].strftime('%Y-%m-%d %H:%M:%S'),
            'bj': r['bj'].strftime('%Y-%m-%d %H:%M:%S') if pd.notna(r['bj']) else None,
            'temp': float(r['气温(℃)']) if pd.notna(r['气温(℃)']) else None,
            'ws': float(r['ws']) if pd.notna(r['ws']) else None,
            'solar': float(r['太阳辐射总强度(down,J/m2)']) if pd.notna(r['太阳辐射总强度(down,J/m2)']) else None,
        })
    write_json('weather.json', {'records': round_nums(records)})


if __name__ == '__main__':
    convert_operation()
    convert_oil_temp()
    convert_oil_level()
    convert_winding()
    convert_chromatography()
    convert_weather()
    print('done')
