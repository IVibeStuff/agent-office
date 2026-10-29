// Every theme in the dropdown. Add a line here to add a theme.
import { buildWorld } from '../world.js';
import { buildStarship } from './starship.js';
import { buildScriptorium } from './scriptorium.js';
import { buildMission } from './mission.js';
import { buildNoir } from './noir.js';
import { buildWizard } from './wizard.js';

export const THEMES = [
  { id: 'office', label: 'Office', build: buildWorld },
  { id: 'starship', label: 'Starship', build: buildStarship },
  { id: 'scriptorium', label: 'Scriptorium', build: buildScriptorium },
  { id: 'mission', label: 'Mission Control', build: buildMission },
  { id: 'noir', label: 'Detective Agency', build: buildNoir },
  { id: 'wizard', label: "Wizard's Tower", build: buildWizard },
];
