# A local Expo module: the system surfaces (build plan Phase 5, WL-01–04, MS-02, MS-03). No package.json,
# so it carries its own version.
Pod::Spec.new do |s|
  s.name           = 'YadaSystem'
  s.version        = '1.0.0'
  s.summary        = 'Widgets, Live Activity, Spotlight and App Intents for Yada'
  s.description    = 'Shares the reading place with the widgets, runs the listening Live Activity, indexes BSB verses in Spotlight and answers Siri and App Shortcuts.'
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Creotok LTD'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit', 'ActivityKit', 'CoreSpotlight', 'AppIntents', 'UserNotifications'
  s.library = 'sqlite3'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
