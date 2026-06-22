const appState = global.ghostBotAppState || (global.ghostBotAppState = {
  startedAt: Date.now(),
  bot: {
    status: "starting",
    provider: "",
    commands: 0,
    authPath: "",
    ownerName: "",
    botName: "",
    platform: "",
    node: ""
  },
  subbots: []
});

export function getAppState() {
  return {
    ...appState,
    bot: { ...appState.bot },
    subbots: appState.subbots.map((subbot) => ({ ...subbot }))
  };
}

export function patchBotState(patch = {}) {
  Object.assign(appState.bot, patch);
}

export function patchSubbotState(subbots = []) {
  appState.subbots = subbots.map((subbot) => ({ ...subbot }));
}
