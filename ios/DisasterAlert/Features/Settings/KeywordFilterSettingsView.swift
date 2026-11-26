import SwiftUI

private enum KeywordInputTarget: String, CaseIterable, Identifiable {
    case include
    case exclude

    var id: String { rawValue }

    var title: String {
        switch self {
        case .include:
            return "포함 키워드"
        case .exclude:
            return "제외 키워드"
        }
    }
}

struct KeywordFilterSettingsView: View {
    @Bindable var settingsStore: SettingsStore
    @State private var keywordInput = ""
    @State private var selectedInputTarget: KeywordInputTarget = .exclude

    var body: some View {
        Form {
            filterModeSection
            keywordInputSection
            registeredKeywordsSection
        }
        .navigationTitle("키워드 필터")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var filterModeSection: some View {
        Section {
            ForEach(KeywordFilterMode.allCases) { mode in
                Button {
                    settingsStore.rule.keywordFilterMode = mode
                    syncInputTarget(for: mode)
                } label: {
                    HStack {
                        Text(mode.displayName)
                            .foregroundStyle(.primary)
                        Spacer()
                        if settingsStore.rule.keywordFilterMode == mode {
                            Image(systemName: "checkmark")
                                .foregroundStyle(.tint)
                                .fontWeight(.semibold)
                        }
                    }
                }
            }
        } header: {
            Text("필터 방식")
        } footer: {
            Text(modeDescription)
        }
    }

    private var keywordInputSection: some View {
        Section {
            if showsTargetSegment {
                Picker("등록 대상", selection: $selectedInputTarget) {
                    ForEach(KeywordInputTarget.allCases) { target in
                        Text(target.title).tag(target)
                    }
                }
                .pickerStyle(.segmented)
            }

            HStack {
                TextField(inputPlaceholder, text: $keywordInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .onSubmit {
                        submitKeyword()
                    }

                Button("추가") {
                    submitKeyword()
                }
                .buttonStyle(.borderedProminent)
                .disabled(keywordInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        } header: {
            Text("키워드 입력")
        } footer: {
            if settingsStore.rule.keywordFilterMode == .disabled {
                Text("키워드를 미리 등록해두고 필요할 때 필터 방식을 변경해 바로 적용할 수 있습니다.")
            }
        }
    }

    @ViewBuilder
    private var registeredKeywordsSection: some View {
        switch settingsStore.rule.keywordFilterMode {
        case .excludeMatching:
            excludeKeywordListSection(title: "등록된 키워드 보기 (제외 키워드)")

        case .includeOnly:
            includeKeywordListSection(title: "등록된 키워드 보기 (포함 키워드)")

        case .includeAndExclude, .disabled:
            includeKeywordListSection(title: "등록된 포함 키워드 (\(settingsStore.rule.includeKeywords.count)개)")
            excludeKeywordListSection(title: "등록된 제외 키워드 (\(settingsStore.rule.excludeKeywords.count)개)")
        }
    }

    private func includeKeywordListSection(title: String) -> some View {
        Section(title) {
            if settingsStore.rule.includeKeywords.isEmpty {
                Text("등록된 포함 키워드가 없습니다.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(settingsStore.rule.includeKeywords) { keyword in
                    HStack {
                        Label(keyword.value, systemImage: "checkmark.circle")
                        Spacer()
                        Button(role: .destructive) {
                            settingsStore.removeIncludeKeyword(keyword)
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(.red)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("\(keyword.value) 삭제")
                    }
                }
                .onDelete { offsets in
                    settingsStore.removeIncludeKeywords(at: offsets)
                }
            }
        }
    }

    private func excludeKeywordListSection(title: String) -> some View {
        Section(title) {
            if settingsStore.rule.excludeKeywords.isEmpty {
                Text("등록된 제외 키워드가 없습니다.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(settingsStore.rule.excludeKeywords) { keyword in
                    HStack {
                        Label(keyword.value, systemImage: "minus.circle")
                        Spacer()
                        Button(role: .destructive) {
                            settingsStore.removeExcludeKeyword(keyword)
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(.red)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("\(keyword.value) 삭제")
                    }
                }
                .onDelete { offsets in
                    settingsStore.removeExcludeKeywords(at: offsets)
                }
            }
        }
    }

    private var showsTargetSegment: Bool {
        switch settingsStore.rule.keywordFilterMode {
        case .includeAndExclude, .disabled:
            return true
        case .excludeMatching, .includeOnly:
            return false
        }
    }

    private var effectiveTarget: KeywordInputTarget {
        switch settingsStore.rule.keywordFilterMode {
        case .excludeMatching:
            return .exclude
        case .includeOnly:
            return .include
        case .includeAndExclude, .disabled:
            return selectedInputTarget
        }
    }

    private var inputPlaceholder: String {
        switch effectiveTarget {
        case .include:
            return "받을 키워드 입력 (예: 화재, 지진, 호우)"
        case .exclude:
            return "제외할 키워드 입력 (예: 훈련, 교통통제)"
        }
    }

    private var modeDescription: String {
        switch settingsStore.rule.keywordFilterMode {
        case .disabled:
            return "키워드 필터를 적용하지 않고 알림지역 조건에 맞는 모든 알림을 표시합니다."
        case .excludeMatching:
            return "등록한 제외 키워드가 본문이나 유형에 포함된 알림을 목록에서 숨깁니다."
        case .includeOnly:
            return "등록한 포함 키워드가 들어 있는 알림만 선별하여 표시합니다."
        case .includeAndExclude:
            return "제외 키워드가 포함된 알림을 걸러내되, 포함 키워드와 동시에 일치하면 포함 키워드를 우선하여 표시합니다."
        }
    }

    private func syncInputTarget(for mode: KeywordFilterMode) {
        switch mode {
        case .excludeMatching:
            selectedInputTarget = .exclude
        case .includeOnly:
            selectedInputTarget = .include
        case .includeAndExclude, .disabled:
            break
        }
    }

    private func submitKeyword() {
        let added: Bool
        switch effectiveTarget {
        case .include:
            added = settingsStore.addIncludeKeyword(keywordInput)
        case .exclude:
            added = settingsStore.addExcludeKeyword(keywordInput)
        }
        if added {
            keywordInput = ""
        }
    }
}
