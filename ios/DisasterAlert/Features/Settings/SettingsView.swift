import SwiftUI

struct SettingsView: View {
    @Bindable var settingsStore: SettingsStore
    let regionCatalogProvider: RegionCatalogProviding

    var body: some View {
        Form {
            Section {
                Toggle("재난알림받기", isOn: $settingsStore.rule.isAlertEnabled)

                NavigationLink {
                    SubscribedRegionsView(
                        settingsStore: settingsStore,
                        regionCatalogProvider: regionCatalogProvider
                    )
                } label: {
                    HStack {
                        Text("알림지역")
                        Spacer()
                        Text(settingsStore.regionSummaryText)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            } header: {
                Text("알림 기본 설정")
            } footer: {
                Text("알림지역을 지정하지 않으면 전국의 안전 알림 기록을 표시합니다.")
            }

            Section {
                Toggle(
                    "긴급알림(Critical Alert) 사용하기",
                    isOn: $settingsStore.rule.isEmergencyOverrideEnabled
                )
            } header: {
                Text("긴급 알림 예외 설정")
            } footer: {
                Text("켜두면 위급재난(지진·민방위 등) 알림은 재난알림받기 해제, 알림지역, 제외 키워드 설정과 관계없이 항상 표시됩니다.")
            }

            Section {
                NavigationLink {
                    KeywordFilterSettingsView(settingsStore: settingsStore)
                } label: {
                    HStack {
                        Text("키워드 필터")
                        Spacer()
                        Text(settingsStore.rule.keywordFilterMode.shortSummary)
                            .foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("맞춤 필터")
            } footer: {
                Text("원하는 키워드만 받거나 불필요한 반복 키워드를 제외한 안전 알림만 모아볼 수 있습니다.")
            }
        }
        .navigationTitle("설정")
        .navigationBarTitleDisplayMode(.inline)
    }
}
