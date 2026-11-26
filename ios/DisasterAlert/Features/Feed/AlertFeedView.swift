import SwiftUI

struct AlertFeedView: View {
    @Bindable var settingsStore: SettingsStore
    @State private var viewModel: AlertFeedViewModel
    @State private var isShowingSettings = false
    private let regionCatalogProvider: RegionCatalogProviding

    init(
        settingsStore: SettingsStore,
        alertRepository: AlertRepositoryProtocol,
        regionCatalogProvider: RegionCatalogProviding
    ) {
        self.settingsStore = settingsStore
        self._viewModel = State(
            initialValue: AlertFeedViewModel(alertRepository: alertRepository)
        )
        self.regionCatalogProvider = regionCatalogProvider
    }

    var body: some View {
        let filteredList = viewModel.filteredAlerts(using: settingsStore.rule)
        let currentState = viewModel.viewState(for: filteredList, rule: settingsStore.rule)

        NavigationStack {
            Group {
                if currentState == .loaded {
                    alertListContent(filteredList)
                } else {
                    FeedStateView(
                        state: currentState,
                        onRetry: {
                            Task {
                                await viewModel.loadAlerts()
                            }
                        },
                        onOpenSettings: {
                            isShowingSettings = true
                        }
                    )
                }
            }
            .navigationTitle("안전 알림 기록")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isShowingSettings = true
                    } label: {
                        Label("설정", systemImage: "gearshape")
                    }
                    .accessibilityIdentifier("openSettingsButton")
                }
            }
            .navigationDestination(isPresented: $isShowingSettings) {
                SettingsView(
                    settingsStore: settingsStore,
                    regionCatalogProvider: regionCatalogProvider
                )
            }
            .navigationDestination(for: DisasterAlert.self) { selectedAlert in
                AlertDetailView(alert: selectedAlert)
            }
            .task {
                if viewModel.allAlerts.isEmpty {
                    await viewModel.loadAlerts()
                }
            }
        }
    }

    private func alertListContent(_ alerts: [DisasterAlert]) -> some View {
        List {
            Section {
                filterSummaryRow(count: alerts.count)
            }

            Section("최근 알림 (\(alerts.count)건)") {
                ForEach(alerts) { alert in
                    NavigationLink(value: alert) {
                        AlertRowView(
                            alert: alert,
                            matchedKeywords: viewModel.matchedKeywords(
                                for: alert,
                                using: settingsStore.rule
                            )
                        )
                    }
                }
            }
        }
        .refreshable {
            await viewModel.loadAlerts()
        }
    }

    private func filterSummaryRow(count: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label("적용 중인 맞춤 필터", systemImage: "line.3.horizontal.decrease.circle")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("표시 \(count)건")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(
                "지역: \(settingsStore.regionSummaryText) · " +
                "키워드: \(settingsStore.rule.keywordFilterMode.shortSummary) · " +
                "긴급알림: \(settingsStore.rule.isEmergencyOverrideEnabled ? "켜짐" : "꺼짐")"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
