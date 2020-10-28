export type StateAction<State> =
  {
    type: "push",
    state: State,
  } |
  {
    type: "pop",
  } |
  {
    type: "idle",
  }
