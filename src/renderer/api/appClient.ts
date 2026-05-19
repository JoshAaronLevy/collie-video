export function getAppInfo() {
  return window.videoAudit.app.getInfo();
}

export function subscribeToAppCommands(
  callback: Parameters<typeof window.videoAudit.app.onCommand>[0]
) {
  return window.videoAudit.app.onCommand(callback);
}
