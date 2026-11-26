import SwiftUI

@main
struct DisasterAlertApp: App {
    @State private var settingsStore = SettingsStore(
        repository: UserDefaultsSettingsRepository()
    )
    private let alertRepository = SampleAlertRepository()
    private let regionCatalogRepository = RegionCatalogRepository()

    var body: some Scene {
        WindowGroup {
            rootContent
        }
    }

    @ViewBuilder
    private var rootContent: some View {
        #if DEBUG
        if let debugRoute = DebugLaunchRoute.current {
            DebugLaunchRouteView(
                route: debugRoute,
                regionCatalogProvider: regionCatalogRepository
            )
        } else {
            defaultFeedView
        }
        #else
        defaultFeedView
        #endif
    }

    private var defaultFeedView: some View {
        AlertFeedView(
            settingsStore: settingsStore,
            alertRepository: alertRepository,
            regionCatalogProvider: regionCatalogRepository
        )
    }
}
