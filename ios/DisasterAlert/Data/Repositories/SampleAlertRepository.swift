import Foundation

public enum AlertRepositoryError: LocalizedError {
    case networkUnavailable

    public var errorDescription: String? {
        switch self {
        case .networkUnavailable:
            return "서버와 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요."
        }
    }
}

public protocol AlertRepositoryProtocol: Sendable {
    func fetchRecentAlerts() async throws -> [DisasterAlert]
}

public struct SampleAlertRepository: AlertRepositoryProtocol {
    public init() {}

    public func fetchRecentAlerts() async throws -> [DisasterAlert] {
        Self.sampleAlerts
    }

    public static let sampleAlerts: [DisasterAlert] = primarySampleAlerts + secondarySampleAlerts

    private static func makeIssuedDate(month: Int, day: Int, hour: Int, minute: Int) -> Date {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        components.year = 2026
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = minute
        return components.date ?? Date()
    }

    private static let primarySampleAlerts: [DisasterAlert] = [
        DisasterAlert(
            id: "MD101-2026-112608",
            category: .fire,
            severity: .urgent,
            message: "[서울특별시청] 오늘 13:45 강남구 역삼동 인근 상가 건물 화재 발생. " +
                "다량의 연기가 발생하고 있으며 주변 도로 교통통제 중이니 인근 주민은 창문을 닫고 우회 바랍니다.",
            targetRegions: [
                TargetRegion(
                    code: "1168010100",
                    provinceName: "서울특별시",
                    districtName: "강남구",
                    neighborhoodName: "역삼동"
                ),
                TargetRegion(
                    code: "1165010800",
                    provinceName: "서울특별시",
                    districtName: "서초구",
                    neighborhoodName: "서초동"
                )
            ],
            issuedAt: makeIssuedDate(month: 11, day: 26, hour: 13, minute: 48),
            senderName: "서울특별시청",
            actionGuidelines: [
                "연기가 유입되지 않도록 창문과 환기구를 즉시 닫아주세요.",
                "현장 주변 소방차 진입로 확보를 위해 우회 도로를 이용해주세요."
            ]
        ),
        DisasterAlert(
            id: "MD101-2026-112607",
            category: .earthquake,
            severity: .emergency,
            message: "[기상청] 11월 26일 11:22 경북 경주시 남남서쪽 9km 지역 규모 4.3 지진 발생. " +
                "낙하물로부터 머리를 보호하고 진동이 멈춘 뒤 야외 넓은 곳으로 대피하세요.",
            targetRegions: [
                TargetRegion(code: "4713000000", provinceName: "경상북도", districtName: "경주시"),
                TargetRegion(code: "3100000000", provinceName: "울산광역시"),
                TargetRegion(code: "2600000000", provinceName: "부산광역시")
            ],
            issuedAt: makeIssuedDate(month: 11, day: 26, hour: 11, minute: 22),
            senderName: "기상청",
            actionGuidelines: [
                "튼튼한 탁자 아래로 들어가 몸과 머리를 보호하세요.",
                "가스와 전기를 차단하고 엘리베이터 대신 계단을 이용하세요.",
                "여진 가능성에 대비해 공터나 학교 운동장으로 대피하세요."
            ]
        ),
        DisasterAlert(
            id: "MD101-2026-112606",
            category: .heavySnow,
            severity: .safety,
            message: "[경기도청] 오늘 밤부터 내일 오전까지 경기 남부 및 동부 지역 많은 눈 예상. " +
                "빙판길 미끄럼 사고에 유의하시고 출퇴근길 대중교통을 이용하시기 바랍니다.",
            targetRegions: [
                TargetRegion(code: "4113500000", provinceName: "경기도", districtName: "성남시 분당구"),
                TargetRegion(code: "4146500000", provinceName: "경기도", districtName: "용인시 수지구"),
                TargetRegion(code: "4182000000", provinceName: "경기도", districtName: "가평군")
            ],
            issuedAt: makeIssuedDate(month: 11, day: 26, hour: 9, minute: 15),
            senderName: "경기도청",
            actionGuidelines: [
                "내 집 앞과 점포 앞 눈을 수시로 치워 낙상 사고를 예방하세요.",
                "차량 운행 시 월동 장구를 구비하고 감속 운행하세요."
            ]
        ),
        DisasterAlert(
            id: "MD101-2026-112505",
            category: .trafficControl,
            severity: .safety,
            message: "[서울특별시청] 금일 22:00~익일 05:00 올림픽대로 일부 구간 시설물 안전점검으로 " +
                "야간 부분 교통통제가 진행됩니다. 서행 및 우회 바랍니다.",
            targetRegions: [
                TargetRegion(code: "1100000000", provinceName: "서울특별시")
            ],
            issuedAt: makeIssuedDate(month: 11, day: 25, hour: 20, minute: 30),
            senderName: "서울특별시청",
            actionGuidelines: [
                "출발 전 실시간 교통정보를 확인하고 우회 노선을 이용하세요."
            ]
        )
    ]

    private static let secondarySampleAlerts: [DisasterAlert] = [
        DisasterAlert(
            id: "MD101-2026-112504",
            category: .forestFire,
            severity: .urgent,
            message: "[강원특별자치도청] 강릉시 성산면 인근 야산 산불 확산 중. " +
                "인근 마을 주민께서는 즉시 지정 대피소(성산초등학교 체육관)로 대피하시기 바랍니다.",
            targetRegions: [
                TargetRegion(
                    code: "5115034000",
                    provinceName: "강원특별자치도",
                    districtName: "강릉시",
                    neighborhoodName: "성산면"
                )
            ],
            issuedAt: makeIssuedDate(month: 11, day: 25, hour: 16, minute: 5),
            senderName: "강원특별자치도청",
            actionGuidelines: [
                "바람이 부는 반대 방향의 저지대나 도로변으로 신속히 대피하세요.",
                "입산 및 소각 행위를 절대 금지해주세요."
            ]
        ),
        DisasterAlert(
            id: "MD101-2026-112403",
            category: .coldWave,
            severity: .safety,
            message: "[세종특별자치시청] 내일 아침 기온 급강하로 한파주의보 발효 예정. " +
                "수도계량기 동파 방지 및 노약자 건강관리에 각별히 유의하시기 바랍니다.",
            targetRegions: [
                TargetRegion(
                    code: "3611025000",
                    provinceName: "세종특별자치시",
                    districtName: "세종시",
                    neighborhoodName: "조치원읍"
                ),
                TargetRegion(
                    code: "3611051500",
                    provinceName: "세종특별자치시",
                    districtName: "세종시",
                    neighborhoodName: "다정동"
                )
            ],
            issuedAt: makeIssuedDate(month: 11, day: 24, hour: 18, minute: 0),
            senderName: "세종특별자치시청",
            actionGuidelines: [
                "장시간 외출 시 온수를 약하게 틀어 동파를 예방하세요.",
                "난방기구 과열 및 일산화탄소 중독에 주의하세요."
            ]
        ),
        DisasterAlert(
            id: "MD101-2026-112402",
            category: .civilDefense,
            severity: .safety,
            message: "[행정안전부] 오늘 14:00부터 20분간 전국 민방위 대피 훈련이 실시됩니다. " +
                "실제 상황이 아닌 정기 훈련이니 침착하게 안내에 협조 바랍니다.",
            targetRegions: [
                TargetRegion(code: "1100000000", provinceName: "서울특별시"),
                TargetRegion(code: "4100000000", provinceName: "경기도"),
                TargetRegion(code: "1200000000", provinceName: "전남광주통합특별시")
            ],
            issuedAt: makeIssuedDate(month: 11, day: 24, hour: 13, minute: 50),
            senderName: "행정안전부",
            actionGuidelines: [
                "훈련 공습경보 발령 시 가까운 지하 대피소 위치를 확인해보세요."
            ]
        ),
        DisasterAlert(
            id: "MD101-2026-112301",
            category: .heavyRain,
            severity: .urgent,
            message: "[부산광역시청] 해운대구 일대 시간당 40mm 이상 강한 호우로 하천 수위 상승 중. " +
                "수영강 산책로 및 지하차도 출입을 즉시 삼가시기 바랍니다.",
            targetRegions: [
                TargetRegion(
                    code: "2635010500",
                    provinceName: "부산광역시",
                    districtName: "해운대구",
                    neighborhoodName: "우동"
                )
            ],
            issuedAt: makeIssuedDate(month: 11, day: 23, hour: 21, minute: 12),
            senderName: "부산광역시청",
            actionGuidelines: [
                "침수 우려 지하차도, 하천변 산책로 접근을 금지하세요.",
                "저지대 및 상습 침수지역 주민은 대피 준비를 해주세요."
            ]
        )
    ]
}
