import Foundation

public protocol SettingsRepositoryProtocol {
    func loadRule() -> AlertFilterRule
    func saveRule(_ rule: AlertFilterRule)
}

public final class UserDefaultsSettingsRepository: SettingsRepositoryProtocol {
    private let userDefaults: UserDefaults
    private let storageKey = "com.undefined.disasteralert.filterRule.v1"

    public init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
    }

    public func loadRule() -> AlertFilterRule {
        guard let encodedRule = userDefaults.data(forKey: storageKey),
              let decodedRule = try? JSONDecoder().decode(AlertFilterRule.self, from: encodedRule) else {
            return AlertFilterRule()
        }
        return decodedRule
    }

    public func saveRule(_ rule: AlertFilterRule) {
        guard let encodedRule = try? JSONEncoder().encode(rule) else {
            return
        }
        userDefaults.set(encodedRule, forKey: storageKey)
    }
}
