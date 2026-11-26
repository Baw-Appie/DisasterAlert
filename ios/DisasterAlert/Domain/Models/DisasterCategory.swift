import Foundation

public enum DisasterCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case earthquake
    case typhoon
    case heavyRain
    case fire
    case forestFire
    case heavySnow
    case heatWave
    case coldWave
    case fineDust
    case civilDefense
    case trafficControl
    case other

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .earthquake:
            return "지진"
        case .typhoon:
            return "태풍"
        case .heavyRain:
            return "호우"
        case .fire:
            return "화재"
        case .forestFire:
            return "산불"
        case .heavySnow:
            return "대설"
        case .heatWave:
            return "폭염"
        case .coldWave:
            return "한파"
        case .fineDust:
            return "미세먼지"
        case .civilDefense:
            return "민방위"
        case .trafficControl:
            return "교통통제"
        case .other:
            return "기타안전"
        }
    }

    public var symbolName: String {
        switch self {
        case .earthquake:
            return "waveform.path.ecg"
        case .typhoon:
            return "hurricane"
        case .heavyRain:
            return "cloud.heavyrain.fill"
        case .fire:
            return "flame.fill"
        case .forestFire:
            return "tree.fill"
        case .heavySnow:
            return "snowflake"
        case .heatWave:
            return "sun.max.trianglebadge.exclamationmark.fill"
        case .coldWave:
            return "thermometer.snowflake"
        case .fineDust:
            return "aqi.high"
        case .civilDefense:
            return "light.beacon.max.fill"
        case .trafficControl:
            return "car.fill"
        case .other:
            return "exclamationmark.shield.fill"
        }
    }
}
