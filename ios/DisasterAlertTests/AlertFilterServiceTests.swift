import XCTest
@testable import DisasterAlert

final class AlertFilterServiceTests: XCTestCase {
    private var filterService: AlertFilterService!

    override func setUp() {
        super.setUp()
        filterService = AlertFilterService()
    }

    override func tearDown() {
        filterService = nil
        super.tearDown()
    }

    func testIncludeKeywordOverridesExcludeKeywordWhenBothMatch() {
        let simultaneousAlert = makeAlert(
            id: "TEST-1",
            category: .fire,
            severity: .urgent,
            message: "강남구 역삼동 상가 화재 발생으로 주변 도로 교통통제 중입니다.",
            regions: [
                TargetRegion(
                    code: "1168010100",
                    provinceName: "서울특별시",
                    districtName: "강남구",
                    neighborhoodName: "역삼동"
                )
            ]
        )
        let excludeOnlyAlert = makeAlert(
            id: "TEST-2",
            category: .trafficControl,
            severity: .safety,
            message: "올림픽대로 야간 시설 점검으로 부분 교통통제 예정입니다.",
            regions: [TargetRegion(code: "1100000000", provinceName: "서울특별시")]
        )

        let rule = AlertFilterRule(
            isAlertEnabled: true,
            subscribedRegions: [],
            isEmergencyOverrideEnabled: false,
            keywordFilterMode: .includeAndExclude,
            includeKeywords: [IncludeKeyword(value: "화재")],
            excludeKeywords: [ExcludeKeyword(value: "교통통제")]
        )

        XCTAssertTrue(
            filterService.shouldDisplayAlert(simultaneousAlert, using: rule),
            "포함 키워드와 제외 키워드가 동시에 매칭되면 포함 키워드를 우선하여 표시해야 합니다."
        )
        XCTAssertFalse(
            filterService.shouldDisplayAlert(excludeOnlyAlert, using: rule),
            "제외 키워드만 매칭된 알림은 목록에서 제외되어야 합니다."
        )
    }

    func testKeywordFilterModesBehaveAsExpected() {
        let rainAlert = makeAlert(
            id: "RAIN-1",
            category: .heavyRain,
            severity: .urgent,
            message: "해운대구 시간당 40mm 강한 호우 주의 바랍니다.",
            regions: [TargetRegion(code: "2635000000", provinceName: "부산광역시", districtName: "해운대구")]
        )
        let drillAlert = makeAlert(
            id: "DRILL-1",
            category: .civilDefense,
            severity: .safety,
            message: "오늘 14시 전국 민방위 대피 훈련이 진행됩니다.",
            regions: [TargetRegion(code: "2600000000", provinceName: "부산광역시")]
        )

        let excludeRule = AlertFilterRule(
            keywordFilterMode: .excludeMatching,
            excludeKeywords: [ExcludeKeyword(value: "훈련")]
        )
        XCTAssertTrue(filterService.shouldDisplayAlert(rainAlert, using: excludeRule))
        XCTAssertFalse(filterService.shouldDisplayAlert(drillAlert, using: excludeRule))

        let includeOnlyRule = AlertFilterRule(
            keywordFilterMode: .includeOnly,
            includeKeywords: [IncludeKeyword(value: "호우")]
        )
        XCTAssertTrue(filterService.shouldDisplayAlert(rainAlert, using: includeOnlyRule))
        XCTAssertFalse(filterService.shouldDisplayAlert(drillAlert, using: includeOnlyRule))

        let disabledRule = AlertFilterRule(
            keywordFilterMode: .disabled,
            includeKeywords: [IncludeKeyword(value: "호우")],
            excludeKeywords: [ExcludeKeyword(value: "훈련")]
        )
        XCTAssertTrue(filterService.shouldDisplayAlert(rainAlert, using: disabledRule))
        XCTAssertTrue(filterService.shouldDisplayAlert(drillAlert, using: disabledRule))
    }

    func testEmergencyOverrideRespectsUserToggleChoice() {
        let earthquakeAlert = makeAlert(
            id: "EQ-1",
            category: .earthquake,
            severity: .emergency,
            message: "경북 경주시 규모 4.3 지진 발생.",
            regions: [TargetRegion(code: "4713000000", provinceName: "경상북도", districtName: "경주시")]
        )

        let seoulSubscription = SubscribedRegion(
            code: "1168010100",
            provinceName: "서울특별시",
            districtName: "강남구",
            neighborhoodName: "역삼동"
        )

        let overrideOnRule = AlertFilterRule(
            isAlertEnabled: false,
            subscribedRegions: [seoulSubscription],
            isEmergencyOverrideEnabled: true,
            keywordFilterMode: .excludeMatching,
            excludeKeywords: [ExcludeKeyword(value: "지진")]
        )
        XCTAssertTrue(
            filterService.shouldDisplayAlert(earthquakeAlert, using: overrideOnRule),
            "긴급알림 사용하기가 켜져 있으면 위급재난은 필터 조건과 무관하게 항상 표시되어야 합니다."
        )

        let overrideOffRule = AlertFilterRule(
            isAlertEnabled: true,
            subscribedRegions: [seoulSubscription],
            isEmergencyOverrideEnabled: false
        )
        XCTAssertFalse(
            filterService.shouldDisplayAlert(earthquakeAlert, using: overrideOffRule),
            "긴급알림 사용하기가 꺼져 있으면 타 지역의 위급재난은 지역 필터를 따라야 합니다."
        )
    }

    func testHierarchicalRegionMatchingAcrossProvinceDistrictAndNeighborhood() {
        let yeoksamSubscription = SubscribedRegion(
            code: "1168010100",
            provinceName: "서울특별시",
            districtName: "강남구",
            neighborhoodName: "역삼동"
        )
        let sejongSubscription = SubscribedRegion(
            code: "3611025000",
            provinceName: "세종특별자치시",
            districtName: "세종시",
            neighborhoodName: "조치원읍"
        )

        let rule = AlertFilterRule(
            subscribedRegions: [yeoksamSubscription, sejongSubscription],
            isEmergencyOverrideEnabled: false
        )

        let seoulWideAlert = makeAlert(
            id: "R-1",
            category: .coldWave,
            severity: .safety,
            message: "서울 전역 한파주의보",
            regions: [TargetRegion(code: "1100000000", provinceName: "서울특별시")]
        )
        let gangnamWideAlert = makeAlert(
            id: "R-2",
            category: .heavyRain,
            severity: .urgent,
            message: "강남구 호우주의보",
            regions: [TargetRegion(code: "1168000000", provinceName: "서울특별시", districtName: "강남구")]
        )
        let daechiAlert = makeAlert(
            id: "R-3",
            category: .fire,
            severity: .urgent,
            message: "대치동 화재",
            regions: [
                TargetRegion(
                    code: "1168010600",
                    provinceName: "서울특별시",
                    districtName: "강남구",
                    neighborhoodName: "대치동"
                )
            ]
        )
        let sejongAlert = makeAlert(
            id: "R-4",
            category: .coldWave,
            severity: .safety,
            message: "조치원읍 한파 안내",
            regions: [
                TargetRegion(
                    code: "3611025000",
                    provinceName: "세종특별자치시",
                    districtName: "세종시",
                    neighborhoodName: "조치원읍"
                )
            ]
        )

        XCTAssertTrue(filterService.shouldDisplayAlert(seoulWideAlert, using: rule))
        XCTAssertTrue(filterService.shouldDisplayAlert(gangnamWideAlert, using: rule))
        XCTAssertFalse(filterService.shouldDisplayAlert(daechiAlert, using: rule))
        XCTAssertTrue(filterService.shouldDisplayAlert(sejongAlert, using: rule))
    }

    func testBundledRegionCatalogLoadsAllProvincesIncludingSejong() throws {
        let repository = RegionCatalogRepository(bundle: .main)
        let catalog = try repository.loadCatalog()

        XCTAssertGreaterThanOrEqual(catalog.provinces.count, 16)
        XCTAssertTrue(catalog.provinces.contains { $0.name == "서울특별시" })
        XCTAssertTrue(catalog.provinces.contains { $0.name == "세종특별자치시" })
        XCTAssertTrue(catalog.provinces.contains { $0.name == "경기도" })
    }

    private func makeAlert(
        id: String,
        category: DisasterCategory,
        severity: SeverityLevel,
        message: String,
        regions: [TargetRegion]
    ) -> DisasterAlert {
        DisasterAlert(
            id: id,
            category: category,
            severity: severity,
            message: message,
            targetRegions: regions,
            issuedAt: Date(timeIntervalSince1970: 1_795_660_000),
            senderName: "테스트기관"
        )
    }
}
