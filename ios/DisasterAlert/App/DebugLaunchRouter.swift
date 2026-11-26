#if DEBUG
import SwiftUI

enum DebugLaunchRoute: String {
    case detail
    case settings
    case regionPicker
    case keywordFilter

    static var current: DebugLaunchRoute? {
        if let envValue = ProcessInfo.processInfo.environment["UI_TEST_ROUTE"],
           let route = DebugLaunchRoute(rawValue: envValue) {
            return route
        }
        for arg in ProcessInfo.processInfo.arguments {
            let prefix = "route="
            if arg.hasPrefix(prefix) {
                let rawRoute = String(arg.dropFirst(prefix.count))
                return DebugLaunchRoute(rawValue: rawRoute)
            }
        }
        return nil
    }
}

struct DebugLaunchRouteView: View {
    let route: DebugLaunchRoute
    let regionCatalogProvider: RegionCatalogProviding

    var body: some View {
        switch route {
        case .detail:
            NavigationStack {
                if let sampleAlert = SampleAlertRepository.sampleAlerts.first {
                    AlertDetailView(alert: sampleAlert)
                }
            }

        case .settings:
            NavigationStack {
                SettingsView(
                    settingsStore: makeSampleSettingsStore(),
                    regionCatalogProvider: regionCatalogProvider
                )
            }

        case .regionPicker:
            NavigationStack {
                if let catalog = try? regionCatalogProvider.loadCatalog(),
                   let seoul = catalog.provinces.first(where: { $0.name == "서울특별시" }),
                   let gangnam = seoul.districts.first(where: { $0.name == "강남구" }) {
                    NeighborhoodSelectionView(
                        province: seoul,
                        district: gangnam,
                        settingsStore: makeSampleSettingsStore(),
                        onRegionSelected: {}
                    )
                }
            }

        case .keywordFilter:
            NavigationStack {
                KeywordFilterSettingsView(settingsStore: makeSampleSettingsStore())
            }
        }
    }

    @MainActor
    private func makeSampleSettingsStore() -> SettingsStore {
        let previewDefaults = UserDefaults(suiteName: "com.undefined.DisasterAlert.preview") ?? .standard
        let repository = UserDefaultsSettingsRepository(userDefaults: previewDefaults)
        let sampleRule = AlertFilterRule(
            isAlertEnabled: true,
            subscribedRegions: [
                SubscribedRegion(
                    code: "1168010100",
                    provinceName: "서울특별시",
                    districtName: "강남구",
                    neighborhoodName: "역삼동"
                ),
                SubscribedRegion(
                    code: "3611025000",
                    provinceName: "세종특별자치시",
                    districtName: "세종시",
                    neighborhoodName: "조치원읍"
                )
            ],
            isEmergencyOverrideEnabled: true,
            keywordFilterMode: .includeAndExclude,
            includeKeywords: [IncludeKeyword(value: "화재"), IncludeKeyword(value: "지진")],
            excludeKeywords: [ExcludeKeyword(value: "훈련"), ExcludeKeyword(value: "교통통제")]
        )
        repository.saveRule(sampleRule)
        return SettingsStore(repository: repository)
    }
}
#endif
