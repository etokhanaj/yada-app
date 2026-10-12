# A local Expo module (apps/mobile/modules is autolinking's default local
# directory). It has no package.json, so it carries its own version.
Pod::Spec.new do |s|
  s.name           = 'YadaCloud'
  s.version        = '1.0.0'
  s.summary        = 'iCloud key-value storage for Yada reader data'
  s.description    = 'NSUbiquitousKeyValueStore get, set, synchronize and its external-change notification, for Yada.'
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Creotok LTD'
  # Required by CocoaPods; a local module has no page of its own, so this is the
  # Expo Modules API it is written against (create-expo-module --local does the same).
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
