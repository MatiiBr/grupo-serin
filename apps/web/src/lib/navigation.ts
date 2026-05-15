let navigateHandler: ((path: string) => void) | null = null;

export function setNavigateHandler(handler: ((path: string) => void) | null) {
  navigateHandler = handler;
}

export function navigate(path: string) {
  if (navigateHandler) {
    navigateHandler(path);
    return;
  }

  window.location.assign(path);
}
