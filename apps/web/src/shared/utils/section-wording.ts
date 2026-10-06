/**
 * @file Fixed wording for section modalities and weekdays, shared by the planner's constraint
 * review and the schedule results so one enum value reads one way everywhere.
 * @module @caa/web/shared/utils/section-wording
 * @requirement FR-09
 * @requirement NFR-02
 */
import type { SectionModality, Weekday } from '@caa/domain';

const MODALITY_WORDING: Readonly<Record<SectionModality, string>> = {
  IN_PERSON: 'In person',
  HYBRID: 'Hybrid',
  ONLINE_SYNCHRONOUS: 'Online, at set times',
  ONLINE_ASYNCHRONOUS: 'Online, no set meeting times',
};

const WEEKDAY_WORDING: Readonly<Record<Weekday, string>> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

/**
 * Names a section's modality.
 *
 * @param modality - The section modality from the API.
 * @returns Its fixed wording.
 */
export function describeModality(modality: SectionModality): string {
  return MODALITY_WORDING[modality];
}

/**
 * Names a weekday.
 *
 * @param weekday - The weekday from the API.
 * @returns For example `Monday`.
 */
export function describeWeekday(weekday: Weekday): string {
  return WEEKDAY_WORDING[weekday];
}
