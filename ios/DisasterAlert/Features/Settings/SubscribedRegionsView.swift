import SwiftUI

struct SubscribedRegionsView: View {
    @Bindable var settingsStore: SettingsStore
    let regionCatalogProvider: RegionCatalogProviding
    @State private var isPresentingRegionPicker = false

    var body: some View {
        List {
            Section {
                Button {
                    isPresentingRegionPicker = true
                } label: {
                    Label("알림지역 추가 (시·도 → 시·군·구 → 읍·면·동)", systemImage: "plus.circle.fill")
                }
            } footer: {
                Text("내 거주지, 가족 거주지 등 여러 관심 지역을 추가할 수 있습니다.")
            }

            Section("등록된 알림지역 (\(settingsStore.rule.subscribedRegions.count)곳)") {
                if settingsStore.rule.subscribedRegions.isEmpty {
                    Text("등록된 알림지역이 없습니다. 현재 전국 알림을 모두 표시합니다.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(settingsStore.rule.subscribedRegions) { region in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(region.displayName)
                                    .font(.body)
                                Text("법정동코드 \(region.code)")
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button(role: .destructive) {
                                settingsStore.removeRegion(region)
                            } label: {
                                Image(systemName: "trash")
                                    .foregroundStyle(.red)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel("\(region.displayName) 삭제")
                        }
                    }
                    .onDelete { offsets in
                        settingsStore.removeRegions(at: offsets)
                    }
                }
            }
        }
        .navigationTitle("알림지역")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !settingsStore.rule.subscribedRegions.isEmpty {
                EditButton()
            }
        }
        .sheet(isPresented: $isPresentingRegionPicker) {
            RegionPickerView(
                settingsStore: settingsStore,
                regionCatalogProvider: regionCatalogProvider
            )
        }
    }
}
