-- 振动监测数据相关表

-- 振动数据集表
CREATE TABLE IF NOT EXISTS vibration_datasets (
    dataset_id VARCHAR(50) PRIMARY KEY,  -- 数据集唯一标识
    name VARCHAR(255) NOT NULL,          -- 数据集名称
    upload_time DATETIME NOT NULL,       -- 上传时间
    description TEXT,                    -- 数据集描述
    INDEX idx_upload_time (upload_time)  -- 上传时间索引，用于按时间排序
);

-- 振动数据通道表
CREATE TABLE IF NOT EXISTS vibration_channels (
    dataset_id VARCHAR(50) NOT NULL,     -- 关联的数据集ID
    channel_id VARCHAR(10) NOT NULL,     -- 通道ID (1-8)
    sampling_rate FLOAT NOT NULL,        -- 采样率 (Hz)
    PRIMARY KEY (dataset_id, channel_id),
    FOREIGN KEY (dataset_id) REFERENCES vibration_datasets(dataset_id) ON DELETE CASCADE
);

-- 振动时域数据表
CREATE TABLE IF NOT EXISTS vibration_time_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dataset_id VARCHAR(50) NOT NULL,     -- 关联的数据集ID
    channel_id VARCHAR(10) NOT NULL,     -- 通道ID
    time_point FLOAT NOT NULL,           -- 时间点
    amplitude FLOAT NOT NULL,            -- 振幅值
    INDEX idx_dataset_channel (dataset_id, channel_id),
    FOREIGN KEY (dataset_id, channel_id) REFERENCES vibration_channels(dataset_id, channel_id) ON DELETE CASCADE
);

-- 振动频域数据表
CREATE TABLE IF NOT EXISTS vibration_frequency_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dataset_id VARCHAR(50) NOT NULL,     -- 关联的数据集ID
    channel_id VARCHAR(10) NOT NULL,     -- 通道ID
    frequency FLOAT NOT NULL,            -- 频率值
    amplitude FLOAT NOT NULL,            -- 振幅值
    INDEX idx_dataset_channel (dataset_id, channel_id),
    FOREIGN KEY (dataset_id, channel_id) REFERENCES vibration_channels(dataset_id, channel_id) ON DELETE CASCADE
);

-- 振动特征值表
CREATE TABLE IF NOT EXISTS vibration_features (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dataset_id VARCHAR(50) NOT NULL,     -- 关联的数据集ID
    channel_id VARCHAR(10) NOT NULL,     -- 通道ID
    feature_name VARCHAR(50) NOT NULL,   -- 特征名称
    feature_value FLOAT NOT NULL,        -- 特征值
    INDEX idx_dataset_channel (dataset_id, channel_id),
    INDEX idx_feature_name (feature_name),
    FOREIGN KEY (dataset_id, channel_id) REFERENCES vibration_channels(dataset_id, channel_id) ON DELETE CASCADE
);

-- 以下是功能索引，用于提高特定查询的性能

-- 根据特征名称和数据集快速获取特征值
CREATE INDEX idx_feature_dataset ON vibration_features(feature_name, dataset_id);

-- 根据频率范围快速查询频域数据
CREATE INDEX idx_frequency_range ON vibration_frequency_data(dataset_id, channel_id, frequency);

-- 根据时间范围快速查询时域数据
CREATE INDEX idx_time_range ON vibration_time_data(dataset_id, channel_id, time_point); 