import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.fft import fft, fftfreq
import glob


# --- Feature Extraction Functions ---

# 1. 均值 (Mean value)
def mean_value(x):
    """计算信号的均值"""
    return np.mean(x)


# 2. 标准差 (Standard deviation)
def standard_deviation(x):
    """计算信号的标准差"""
    return np.std(x)


# 3. 峰度 (Kurtosis)
def kurtosis(x):
    """计算信号的峰度"""
    return np.mean((x - np.mean(x)) ** 4) / (np.std(x) ** 4)


# 4. 均方根 (Root mean square)
def root_mean_square(x):
    """计算信号的均方根"""
    return np.sqrt(np.mean(x ** 2))


# 5. 波形因子 (Wave form factor)
def wave_form_factor(x):
    """计算波形因子 = 均方根 / 均值"""
    mean = mean_value(np.abs(x))  # Use absolute values to avoid division by zero or negative values
    if mean == 0:
        return np.nan
    return root_mean_square(x) / mean


# 6. 峰值因子 (Peak factor)
def peak_factor(x):
    """计算峰值因子 = 峰值 / 均方根"""
    rms = root_mean_square(x)
    if rms == 0:
        return np.nan
    return np.max(np.abs(x)) / rms


# 7. 中心频率 (Center frequency)
def center_frequency(x, fs):
    """计算中心频率，fs为采样频率"""
    freqs = np.fft.fftfreq(len(x), d=1 / fs)
    fft_vals = np.abs(fft(x))
    if np.sum(fft_vals) == 0:
        return np.nan
    return np.sum(freqs[:len(x) // 2] * fft_vals[:len(x) // 2]) / np.sum(fft_vals[:len(x) // 2])


# 8. 频率方差 (Frequency variance)
def frequency_variance(x, fs):
    """计算频率方差，fs为采样频率"""
    freqs = np.fft.fftfreq(len(x), d=1 / fs)
    fft_vals = np.abs(fft(x))
    fc = center_frequency(x, fs)
    if np.isnan(fc) or np.sum(fft_vals) == 0:
        return np.nan
    return np.sum((freqs[:len(x) // 2] - fc) ** 2 * fft_vals[:len(x) // 2]) / np.sum(fft_vals[:len(x) // 2])


# 9. 脉冲因子 (Pulse factor)
def pulse_factor(x):
    """计算脉冲因子 = 峰值 / 均值"""
    mean = mean_value(np.abs(x))
    if mean == 0:
        return np.nan
    return np.max(np.abs(x)) / mean


# 10. 间隙因子 (Clearance factor)
def clearance_factor(x):
    """计算间隙因子 = 峰值 / (均根值的平方)"""
    root_mean = np.mean(np.sqrt(np.abs(x)))
    if root_mean == 0:
        return np.nan
    return np.max(np.abs(x)) / (root_mean) ** 2


# 11. 波形中心 (Waveform center)
def waveform_center(x):
    """计算波形中心"""
    t = np.arange(len(x))
    if np.sum(x ** 2) == 0:
        return np.nan
    return np.sum(t * x ** 2) / np.sum(x ** 2)


# 12. 时间带宽 (Time width)
def time_width(x):
    """计算时间带宽"""
    t = np.arange(len(x))
    tc = waveform_center(x)
    if np.isnan(tc) or np.sum(x ** 2) == 0:
        return np.nan
    return np.sqrt(np.sum((t - tc) ** 2 * x ** 2) / np.sum(x ** 2))


# 13. 均方频率 (Mean square frequency)
def mean_square_frequency(x, fs):
    """计算均方频率，fs为采样频率"""
    freqs = np.fft.fftfreq(len(x), d=1 / fs)
    fft_vals = np.abs(fft(x))
    if np.sum(fft_vals) == 0:
        return np.nan
    return np.sum((freqs[:len(x) // 2] ** 2) * fft_vals[:len(x) // 2]) / np.sum(fft_vals[:len(x) // 2])


# 14. 均方根频率 (Root mean square frequency)
def root_mean_square_frequency(x, fs):
    """计算均方根频率，fs为采样频率"""
    msf = mean_square_frequency(x, fs)
    if np.isnan(msf) or msf < 0:
        return np.nan
    return np.sqrt(msf)


# 15. 频率标准差 (Frequency standard deviation)
def frequency_standard_deviation(x, fs):
    """计算频率标准差，fs为采样频率"""
    var = frequency_variance(x, fs)
    if np.isnan(var) or var < 0:
        return np.nan
    return np.sqrt(var)


# 16. 峰值 (Peak value)
def peak_value(x):
    """计算峰值"""
    return np.max(np.abs(x))


def calculate_all_features(signal, fs):
    """计算给定信号的所有特征值"""
    features = {
        "均值": mean_value(signal),
        "标准差": standard_deviation(signal),
        "峰度": kurtosis(signal),
        "均方根": root_mean_square(signal),
        "波形因子": wave_form_factor(signal),
        "峰值因子": peak_factor(signal),
        "中心频率 (Hz)": center_frequency(signal, fs),
        "频率方差": frequency_variance(signal, fs),
        "脉冲因子": pulse_factor(signal),
        "间隙因子": clearance_factor(signal),
        "波形中心": waveform_center(signal),
        "时间带宽": time_width(signal),
        "均方频率 (Hz)": mean_square_frequency(signal, fs),
        "均方根频率 (Hz)": root_mean_square_frequency(signal, fs),
        "频率标准差 (Hz)": frequency_standard_deviation(signal, fs),
        "峰值": peak_value(signal)
    }
    return features


def time_to_frequency_domain(input_file, output_file=None, fs=1000):
    """
    Transform time domain data from CSV to frequency domain, save results and generate frequency domain visualization

    Parameters:
    input_file (str): Path to input CSV file
    output_file (str): Path to save the output frequency domain data
                       If None, automatically generate based on input filename
    fs (int): Sampling frequency in Hz, default is 1000 Hz (10000 points over 10s)
    """
    # If output file not specified, create one with "_freq" suffix
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]
        output_file = f"{base_name}_freq.csv"

    # Create feature output path
    feature_output = f"{os.path.splitext(input_file)[0]}_features.csv"

    # Create image output path
    image_output = f"{os.path.splitext(input_file)[0]}_freq.png"
    time_image_output = f"{os.path.splitext(input_file)[0]}_time.png"

    # Read time domain data - no header in file
    try:
        # Read raw data without headers
        signal = np.loadtxt(input_file, delimiter=',')
        print(f"Processing {input_file}...")

        # For single channel data (single row or column)
        if len(signal.shape) == 1:
            # Single row or column of data
            n = len(signal)
        else:
            # If it's a 2D array, we need to flatten or pick the right dimension
            # Assuming each row is a timestamp (10000 columns)
            n = signal.shape[1]
            # Use first row as our signal
            signal = signal[0]

        # Calculate time step based on sampling frequency
        dt = 1.0 / fs
        time = np.arange(0, n * dt, dt)

        # Calculate signal features
        features = calculate_all_features(signal, fs)

        # Create DataFrame for features and save to CSV
        features_df = pd.DataFrame([features])
        features_df.to_csv(feature_output, index=False)
        print(f"Signal features saved to {feature_output}")

        # Perform FFT
        yf = fft(signal)
        # Generate frequency bins up to Nyquist frequency
        xf = fftfreq(n, dt)[:n // 2]

        # Calculate amplitude spectrum (normalized)
        amplitude = 2.0 / n * np.abs(yf[:n // 2])

        # Create DataFrame for output
        freq_df = pd.DataFrame({
            'Frequency': xf,
            'Amplitude': amplitude
        })

        # Save to CSV
        freq_df.to_csv(output_file, index=False)
        print(f"Frequency domain data saved to {output_file}")

        # Create visualization - time domain
        plt.figure(figsize=(12, 6))
        plt.plot(time, signal)
        plt.title(f'Time Domain Signal - {os.path.basename(input_file)}')
        plt.xlabel('Time (s)')
        plt.ylabel('Amplitude')
        plt.grid(True)

        # Add basic statistics to time domain plot
        plt.figtext(0.02, 0.02,
                    f'Time Domain Statistics:\n'
                    f'Mean: {features["均值"]:0.4f}\n'
                    f'RMS: {features["均方根"]:0.4f}\n'
                    f'Peak: {features["峰值"]:0.4f}\n'
                    f'Kurtosis: {features["峰度"]:0.4f}',
                    fontsize=10, bbox=dict(facecolor='white', alpha=0.8))

        plt.tight_layout()
        plt.savefig(time_image_output, dpi=300)
        plt.close()
        print(f"Time domain plot saved to {time_image_output}")

        # Create visualization - frequency domain (horizontal)
        plt.figure(figsize=(12, 6))

        # Limit the frequency range to show most relevant frequencies (0-50Hz)
        # This can be adjusted based on what's relevant for your vibration data
        freq_limit = 50  # Hz
        mask = xf <= freq_limit

        plt.plot(xf[mask], amplitude[mask])
        plt.title(f'Frequency Domain Analysis - {os.path.basename(input_file)}')
        plt.xlabel('Frequency (Hz)')
        plt.ylabel('Amplitude')
        plt.grid(True)

        # Add frequency domain statistics as text
        plt.figtext(0.02, 0.02,
                    f'Frequency Domain Statistics:\n'
                    f'Peak frequency: {xf[np.argmax(amplitude)]:0.2f} Hz\n'
                    f'Peak amplitude: {np.max(amplitude):0.4f}\n'
                    f'Center frequency: {features["中心频率 (Hz)"]:0.2f} Hz\n'
                    f'RMS frequency: {features["均方根频率 (Hz)"]:0.2f} Hz\n'
                    f'Sampling frequency: {fs} Hz',
                    fontsize=10, bbox=dict(facecolor='white', alpha=0.8))

        plt.tight_layout()
        plt.savefig(image_output, dpi=300)
        plt.close()

        print(f"Frequency domain plot saved to {image_output}")
        return True

    except Exception as e:
        print(f"Error processing {input_file}: {str(e)}")
        return False


def process_folder(folder_path):
    """Process all CSV files in a folder"""
    # Get all CSV files in the folder
    csv_files = glob.glob(os.path.join(folder_path, "data*.csv"))

    # Filter to include only data1.csv through data8.csv
    csv_files = [f for f in csv_files if os.path.basename(f).startswith("data") and
                 os.path.basename(f)[4:5].isdigit() and
                 1 <= int(os.path.basename(f)[4:5]) <= 8 and
                 os.path.basename(f).endswith(".csv")]

    print(f"Found {len(csv_files)} files to process in {folder_path}")

    # Process each file
    for file in csv_files:
        time_to_frequency_domain(file)

    # After processing all files, create summary of features
    create_feature_summary(folder_path)


def create_feature_summary(folder_path):
    """创建所有特征的汇总表格"""
    # Get all feature files
    feature_files = glob.glob(os.path.join(folder_path, "*_features.csv"))

    if not feature_files:
        print("No feature files found to summarize.")
        return

    print(f"Creating feature summary for {len(feature_files)} files...")

    # Create an empty list to store all feature DataFrames
    all_features = []

    # Process each feature file
    for file in feature_files:
        try:
            df = pd.read_csv(file)
            # Add filename as a column
            df['文件名'] = os.path.basename(file).replace('_features.csv', '')
            all_features.append(df)
        except Exception as e:
            print(f"Error reading {file}: {str(e)}")

    if all_features:
        # Combine all features into one DataFrame
        summary_df = pd.concat(all_features, ignore_index=True)

        # Move filename column to first position
        cols = summary_df.columns.tolist()
        cols = [cols[-1]] + cols[:-1]
        summary_df = summary_df[cols]

        # Save summary to CSV
        summary_path = os.path.join(folder_path, "特征汇总.csv")
        summary_df.to_csv(summary_path, index=False)
        print(f"Feature summary saved to {summary_path}")
    else:
        print("No valid feature data found for summary.")


# Main execution
if __name__ == "__main__":
    # Folder paths
    default_folder1 = r"D:\OneDrive\Desktop\研一研究+指导资料\柴\杨高中路数据汇总\振动数据\打桩信号_1"
    default_folder2 = r"D:\OneDrive\Desktop\研一研究+指导资料\柴\杨高中路数据汇总\振动数据\打桩信号_2"

    # Prompt for folder paths or use defaults
    print("振动信号分析程序")
    print("默认文件夹路径:")
    print(f"1. {default_folder1}")
    print(f"2. {default_folder2}")

    use_default = input("是否使用默认路径？(Y/N): ").strip().upper()

    if use_default == 'Y' or use_default == '':
        folder1 = default_folder1
        folder2 = default_folder2
    else:
        folder1 = input("请输入第一个文件夹路径: ").strip()
        folder2 = input("请输入第二个文件夹路径: ").strip()

        # 检查文件夹是否存在
        if not os.path.exists(folder1):
            print(f"错误：文件夹不存在 {folder1}")
            folder1 = None
        if not os.path.exists(folder2):
            print(f"错误：文件夹不存在 {folder2}")
            folder2 = None

    # Create a summary file
    summary_text = """
时域与频域信号分析关系说明

什么是时域与频域转换：
时域信号是指随时间变化的信号，而频域信号则表示该信号中包含的不同频率成分。
傅里叶变换（FFT）可以将时域信号转换为频域信号，帮助我们了解信号中的频率组成。

应用于振动信号分析：
1. 时域分析显示振动随时间的变化情况，直观但难以识别隐藏的频率特征
2. 频域分析显示不同频率的振动强度，有助于识别：
   - 结构的固有频率
   - 设备的运行频率
   - 可能的故障频率
   - 共振条件

如何解读频域图：
- 横轴：频率（Hz，表示每秒振动次数）
- 纵轴：振幅（表示该频率的强度）
- 峰值：表示信号中主要的频率成分

在工程应用中的意义：
- 主导频率的识别有助于确定振动源
- 大幅值的低频振动可能指示结构问题
- 特定频率范围的振动可能与设备故障相关
- 某些频率的振幅超标可能表明需要振动控制措施

打桩作业相关分析：
- 打桩过程中常见的频率范围通常为5-50Hz
- 不同土质和打桩方式会产生不同的频率特征
- 高振幅的低频振动（5-20Hz）常见于打桩作业
- 此类振动可能对周边建筑物产生影响

特征参数解释：
- 均值：信号的平均值，反映信号的整体强度水平
- 标准差：反映信号波动程度的指标
- 峰度：描述信号峰值特性，高峰度意味着信号有尖锐的峰
- 均方根：反映信号能量的指标
- 波形因子：信号波形特征的指标
- 中心频率：信号频谱的中心位置
- 频率方差：反映频率分布分散程度
- 峰值频率：振幅最大的频率分量

注意：具体分析结果需结合工程背景、打桩方式和地质条件来解读。
    """

    # 如果至少有一个有效的文件夹，创建汇总说明文件
    if folder1 or folder2:
        output_dir = os.path.dirname(folder1) if folder1 else os.path.dirname(folder2)
        with open(os.path.join(output_dir, "振动分析说明.txt"), "w", encoding="utf-8") as f:
            f.write(summary_text)

        print("开始时域到频域转换分析...")

        # 处理文件夹
        if folder1:
            process_folder(folder1)
        if folder2:
            process_folder(folder2)

        print("分析完成!")

        print("\n振动信号分析完成！")
        print("1. 每个信号文件都生成了对应的频域CSV文件")
        print("2. 每个信号文件都生成了时域和频域可视化图像")
        print("3. 每个信号文件都生成了16个特征参数的CSV文件")
        print("4. 在每个文件夹中生成了一份特征汇总表")
        print("5. 在文件夹中生成了一份'振动分析说明.txt'，解释时域与频域的关系")
        print("\n可视化图像中包含：")
        print("- 时域图：显示原始信号随时间的变化")
        print("- 频谱分析图：显示0-50Hz的频率范围，可根据需要调整代码修改范围")
        print("- 图像底部：关键统计数据，包括峰值频率、峰值振幅等")
    else:
        print("未找到有效的文件夹路径，程序退出。")
