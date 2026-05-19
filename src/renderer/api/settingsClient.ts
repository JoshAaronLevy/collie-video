export function getSettings() {
  return window.videoAudit.settings.get();
}

export function updateSettings(
  partialSettings: Parameters<typeof window.videoAudit.settings.update>[0]
) {
  return window.videoAudit.settings.update(partialSettings);
}

export function resetSettings() {
  return window.videoAudit.settings.reset();
}
