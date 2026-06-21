const appState = global.ghostBotAppState || (global.ghostBotAppState = {
  startedAt: Date.now(),
  web: {
    status: "starting",
    url: ""
  },
  bot: {
    status: "starting",
    provider: "",
    commands: 0,
    authPath: "",
    ownerName: "",
    botName: ""
  }
});

export function getAppState() {
  return {
    ...appState,
    web: { ...appState.web },
    bot: { ...appState.bot }
  };
}

export function patchBotState(patch = {}) {
  Object.assign(appState.bot, patch);
}

export function patchWebState(patch = {}) {
  Object.assign(appState.web, patch);
}
