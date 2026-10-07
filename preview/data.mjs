// Public preview data is sourced from the same authoritative shared modules as production.
// preview/build.mjs may replace this file with a generated literal for standalone distribution.
import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../src/shared/atlas.mjs';
import { jobs, catalog, properties, transportModes, appearanceOptions, activities } from '../src/shared/catalogue.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, LOAN_META, HOME_UPGRADES } from '../src/shared/life.mjs';
import { VEHICLE_COLORS } from '../src/shared/vehicles.mjs';
import { ORIGIN_META } from '../src/shared/origins.mjs';
import { JOB_SCHEDULES } from '../src/shared/simulation.mjs';
import { HOME_WALL_COLORS, HOME_FLOORS, DEFAULT_HOME_DESIGN, HOME_DESIGN_LIMITS } from '../src/shared/home-design.mjs';

export default {
  atlas: ABUJA_ATLAS,
  councils: AREA_COUNCILS,
  landmarks: LANDMARKS,
  atlasMeta: ATLAS_META,
  jobs,
  catalog,
  properties,
  transportModes,
  appearanceOptions,
  activities,
  venues: VENUES,
  venueActions: VENUE_ACTIONS,
  lifeGoals: LIFE_GOALS,
  economyMeta: ECONOMY_META,
  walletMeta: WALLET_META,
  investmentMeta: INVESTMENT_META,
  diceMeta: DICE_META,
  loanMeta: LOAN_META,
  originMeta: ORIGIN_META,
  jobSchedules: JOB_SCHEDULES,
  vehicleColors: VEHICLE_COLORS,
  homeUpgrades: HOME_UPGRADES,
  homeDesign: {
    wallColors: HOME_WALL_COLORS,
    floors: HOME_FLOORS,
    defaults: DEFAULT_HOME_DESIGN,
    limits: HOME_DESIGN_LIMITS,
  },
};
