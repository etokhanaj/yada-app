Pod::Spec.new do |s|
  s.name           = 'YadaSpeech'
  s.version        = '1.0.0'
  s.summary        = 'Read-along on Apple on-device speech'
  s.description    = 'AVSpeechSynthesizer with word-boundary events, Now Playing and remote commands'
  s.license        = 'UNLICENSED'
  s.author         = 'Creotok LTD'
  s.homepage       = 'https://github.com/etokhanaj/yada'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  # Yada's icon for the lock screen and Dynamic Island (MPMediaItemArtwork). A copy of
  # assets/brand/icon.png: the app icon set in the asset catalog cannot be read back as an image.
  s.resource_bundles = { 'YadaSpeech' => ['Resources/NowPlayingArtwork.png'] }
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
