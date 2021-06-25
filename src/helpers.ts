import { AttributeType, TimerBarConfig, HassEntity } from "./types";
import { durationToSeconds, formatTime, HomeAssistant } from "custom-card-helpers";

function tryDurationToSeconds(duration: string, field?: string) {
  try {
    const seconds = durationToSeconds(duration);
    if (isNaN(seconds)) throw new Error(`Error parsing ${field || 'duration'} ${duration}: check it matches the format 0:10:00`);
    return seconds;
  } catch (e) {
    throw new Error(`Could not convert ${field || 'duration'}: ${duration} is not of format 0:10:00`);
  }
}

/** Find the duration of the timer. */
export function findDuration(hass: HomeAssistant, config: TimerBarConfig, stateObj: HassEntity) {
  const duration = attribute(hass, stateObj, config.duration);

  if (duration && typeof duration === 'string') return tryDurationToSeconds(duration);
  else if (duration) return duration;

  const start_time = attribute(hass, stateObj, config.start_time);
  const end_time = attribute(hass, stateObj, config.end_time);
  if (start_time && end_time) return (Date.parse(end_time) - Date.parse(start_time)) / 1000;

  return null;
}

/** Calculate the most accurate estimate of time remaining for the timer. */
export const timerTimeRemaining = (hass: HomeAssistant, config: TimerBarConfig, stateObj: HassEntity): undefined | number => {
  const madeActive = new Date(stateObj.last_changed).getTime();

  if (stateObj.attributes.remaining) { // For Home Assistant timers
    let timeRemaining = tryDurationToSeconds(stateObj.attributes.remaining, 'remaining');

    if (isState(stateObj, config.active_state!)) {
      const now = new Date().getTime();
      // Why timeRemaining and not duration?
      timeRemaining = Math.max(timeRemaining - (now - madeActive) / 1000, 0);
    }
    return timeRemaining;
  }

  const end_time = attribute(hass, stateObj, config.end_time!);
  if (end_time) // For OpenSprinkler timers + others
    return (Date.parse(end_time) - Date.now()) / 1000;

  const start_time = attribute(hass, stateObj, config.start_time);
  const duration = attribute(hass, stateObj, config.duration);

  if (start_time && duration)
    return (Date.parse(start_time) - Date.now()) / 1000 + tryDurationToSeconds(duration);

  if (duration)
    return (madeActive - Date.now()) / 1000 + tryDurationToSeconds(duration);

  return undefined;
};

/** Calculate what percent of the timer's duration has passed. */
export const timerTimePercent = (hass: HomeAssistant, config: TimerBarConfig, stateObj: HassEntity): undefined | number => {
  const remaining = timerTimeRemaining(hass, config, stateObj);
  const duration = findDuration(hass, config, stateObj);

  if (!duration || !remaining) return undefined;

  return (duration - remaining) / duration * 100;
};

export const formatStartTime = (stateObj: HassEntity) => {
  const start = new Date(stateObj.attributes.start_time);

  const lang = JSON.parse(localStorage.getItem('selectedLanguage') || '"en"') || 'en';
  return formatTime(start, lang);
}

export const isState = (stateObj: HassEntity | undefined, checkState: string | string[]) => {
  if (!stateObj) return false;
  if (typeof checkState === 'string') return stateObj.state === checkState;

  return checkState.includes(stateObj.state);
}

export const attribute = (hass: HomeAssistant, stateObj: HassEntity, attrib: AttributeType | undefined) => {
  if (!attrib) throw new Error('One of duration, start_time, or end_time was not fully specified. Make sure you set entity, fixed, or attribute');
  if ('fixed' in attrib) return attrib.fixed;
  if ('entity' in attrib) return hass.states[attrib.entity].state;
  return stateObj.attributes[attrib.attribute];
}
