import { HomeAssistant, PlaywrightBrowser, PlaywrightElement } from "hass-taste-test";
import { toMatchDualSnapshot, synchronizeTimerRunning } from "./util";

expect.extend({ toMatchDualSnapshot });

const CONFIGURATION_YAML = `
input_boolean:
  switch:

input_number:
  duration:
    min: 1
    max: 20
    initial: 3

automation switch_off:
  alias: 'Turn switch off after some time, configurable with an input_number'
  trigger:
    - platform: state
      entity_id: input_boolean.switch
      to: 'on'
  condition: []
  action:
    - wait_template: ''
      timeout: '{{ states(''input_number.duration'') }}'
    - service: input_boolean.turn_off
      target:
        entity_id: input_boolean.switch
`;

let hass: HomeAssistant<PlaywrightElement>;

beforeAll(async () => {
  hass = await HomeAssistant.create(CONFIGURATION_YAML, {
    browser: new PlaywrightBrowser(process.env.BROWSER || "firefox"),
  });
  await hass.addResource(__dirname + "/../dist/timer-bar-card.js", "module");
}, 30000);
afterAll(async () => await hass.close());

it("Switch with input_number turns off", async () => {
  const dashboard = await hass.Dashboard([{
    type: "custom:timer-bar-card",
    entities: ["input_boolean.switch"],
    duration: { entity: "input_number.duration", "units": "seconds" },
  }]);
  const card = dashboard.cards[0];
  await hass.callService('homeassistant', 'turn_on', {}, { entity_id: "input_boolean.switch" });
  await synchronizeTimerRunning(hass, "input_boolean.switch", 1);
  await expect(card).toMatchDualSnapshot("running");
  await synchronizeTimerRunning(hass, "input_boolean.switch", 3.5);
  await expect(card).toMatchDualSnapshot("idle");
});
