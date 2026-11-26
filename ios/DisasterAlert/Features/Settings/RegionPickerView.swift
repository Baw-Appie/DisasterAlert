import SwiftUI

struct RegionPickerView: View {
    @Bindable var settingsStore: SettingsStore
    let regionCatalogProvider: RegionCatalogProviding
    @Environment(\.dismiss) private var dismiss

    @State private var provinces: [ProvinceNode] = []
    @State private var loadErrorMessage: String?
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            Group {
                if let loadErrorMessage {
                    ContentUnavailableView {
                        Label("지역 정보를 불러올 수 없습니다", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(loadErrorMessage)
                    } actions: {
                        Button("다시 시도") {
                            loadCatalog()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else if provinces.isEmpty {
                    ProgressView("법정동 목록을 불러오는 중입니다...")
                } else {
                    List(filteredProvinces) { province in
                        NavigationLink(value: province) {
                            HStack {
                                Text(province.name)
                                Spacer()
                                Text("\(province.districts.count)개 시·군·구")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .searchable(text: $searchText, prompt: "시·도 검색")
                }
            }
            .navigationTitle("시·도 선택")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }
            }
            .navigationDestination(for: ProvinceNode.self) { province in
                DistrictSelectionView(
                    province: province,
                    settingsStore: settingsStore,
                    onRegionSelected: {
                        dismiss()
                    }
                )
            }
            .task {
                if provinces.isEmpty {
                    loadCatalog()
                }
            }
        }
    }

    private var filteredProvinces: [ProvinceNode] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return provinces
        }
        return provinces.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    private func loadCatalog() {
        do {
            let catalog = try regionCatalogProvider.loadCatalog()
            provinces = catalog.provinces
            loadErrorMessage = nil
        } catch {
            loadErrorMessage = error.localizedDescription
        }
    }
}

struct DistrictSelectionView: View {
    let province: ProvinceNode
    @Bindable var settingsStore: SettingsStore
    let onRegionSelected: () -> Void
    @State private var searchText = ""

    var body: some View {
        List {
            Section("광역 단위 선택") {
                let isSubscribed = settingsStore.isRegionSubscribed(code: province.code)
                Button {
                    settingsStore.addRegion(
                        SubscribedRegion(code: province.code, provinceName: province.name)
                    )
                    onRegionSelected()
                } label: {
                    HStack {
                        Text("\(province.name) 전체")
                            .fontWeight(.medium)
                        Spacer()
                        if isSubscribed {
                            Label("등록됨", systemImage: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .disabled(isSubscribed)
            }

            Section("시·군·구 선택") {
                ForEach(filteredDistricts) { district in
                    NavigationLink {
                        NeighborhoodSelectionView(
                            province: province,
                            district: district,
                            settingsStore: settingsStore,
                            onRegionSelected: onRegionSelected
                        )
                    } label: {
                        HStack {
                            Text(district.name)
                            Spacer()
                            Text("\(district.neighborhoods.count)개 읍·면·동")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(province.name)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchText, prompt: "시·군·구 검색")
    }

    private var filteredDistricts: [DistrictNode] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return province.districts
        }
        return province.districts.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }
}

struct NeighborhoodSelectionView: View {
    let province: ProvinceNode
    let district: DistrictNode
    @Bindable var settingsStore: SettingsStore
    let onRegionSelected: () -> Void
    @State private var searchText = ""

    var body: some View {
        List {
            Section("시·군·구 단위 선택") {
                let isDistrictSubscribed = settingsStore.isRegionSubscribed(code: district.code)
                Button {
                    settingsStore.addRegion(
                        SubscribedRegion(
                            code: district.code,
                            provinceName: province.name,
                            districtName: district.name
                        )
                    )
                    onRegionSelected()
                } label: {
                    HStack {
                        Text("\(province.name) \(district.name) 전체")
                            .fontWeight(.medium)
                        Spacer()
                        if isDistrictSubscribed {
                            Label("등록됨", systemImage: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .disabled(isDistrictSubscribed)
            }

            Section("읍·면·동 선택") {
                ForEach(filteredNeighborhoods) { neighborhood in
                    let isSubscribed = settingsStore.isRegionSubscribed(code: neighborhood.code)
                    Button {
                        settingsStore.addRegion(
                            SubscribedRegion(
                                code: neighborhood.code,
                                provinceName: province.name,
                                districtName: district.name,
                                neighborhoodName: neighborhood.name
                            )
                        )
                        onRegionSelected()
                    } label: {
                        HStack {
                            Text(neighborhood.name)
                                .foregroundStyle(.primary)
                            Spacer()
                            if isSubscribed {
                                Label("등록됨", systemImage: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .disabled(isSubscribed)
                }
            }
        }
        .navigationTitle(district.name)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchText, prompt: "읍·면·동 검색")
    }

    private var filteredNeighborhoods: [NeighborhoodNode] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return district.neighborhoods
        }
        return district.neighborhoods.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }
}
