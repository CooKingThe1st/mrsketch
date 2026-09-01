import type { ProjectLayout, RobotDefinition, PlotOptions } from '../types/schema';

export const DEFAULT_TEX_MACROS = `
\\newcommand{\\zrobotstate}[1]{\\boldsymbol{q}_{r\\ifblank{#1}{}{,#1}}}
\\newcommand{\\zrobotx}[1]{x_{r\\ifblank{#1}{}{,#1}}}
\\newcommand{\\zroboty}[1]{y_{r\\ifblank{#1}{}{,#1}}}
\\newcommand{\\zrobotorientation}[1]{\\theta_{r\\ifblank{#1}{}{,#1}}}
\\newcommand{\\zrobotvelocity}[1]{\\boldsymbol{v}_{r\\ifblank{#1}{}{,#1}}}
\\newcommand{\\zcontactpointidx}[1]{\\boldsymbol{cp}_{#1}}

\\newcommand{\\zmass}{m}
\\newcommand{\\zinertia}{I_{cm}}
\\newcommand{\\zcom}{O_{cm}}
\\newcommand{\\zobjectfullstate}{\\mathcal{X}}
\\newcommand{\\zobjectvelocity}{\\mathcal{V}}
\\newcommand{\\zvelox}{\\dot{x}}
\\newcommand{\\zveloy}{\\dot{y}}
\\newcommand{\\zvelotheta}{\\dot{\\theta}}
\\newcommand{\\zrotationmatrix}{\\boldsymbol{\\mathcal{R}}}
\\newcommand{\\zobjectorientation}{\\theta}
\\newcommand{\\zobjectmassmatrix}{\\boldsymbol{M}_{\\mathcal{O}}}
\\newcommand{\\zobjectx}{x_{\\mathcal{O}}}
\\newcommand{\\zobjecty}{y_{\\mathcal{O}}}
\\newcommand{\\zobjectedge}{E}
\\newcommand{\\zobjectedges}{E}
\\newcommand{\\zobjectcontactpatch}{\\mathcal{P}_{contact}}
\\newcommand{\\zobjectcontactradius}{r_{\\mathrm{eq}}}
\\newcommand{\\zobjectoccupiedarea}{\\mathcal{A}_{\\mathcal{O}}}
\\newcommand{\\zobject}{\\mathcal{O}}

\\newcommand{\\zlsmatrix}{\\boldsymbol{\\mathcal{Q}}}
\\newcommand{\\zpurex}{f_x}
\\newcommand{\\zpurey}{f_y}
\\newcommand{\\zpurem}{m}

\\newcommand{\\zrobot}{\\boldsymbol{r}}
\\newcommand{\\zrobottotal}{N_{robot}}
\\newcommand{\\zrobotset}{\\mathcal{R}}
\\newcommand{\\zrobotradius}{r_{robot}}
\\newcommand{\\zrobotcenter}{\\boldsymbol{p}_{r}}
\\newcommand{\\zrobotforce}{\\boldsymbol{f}}
\\newcommand{\\zrobotleverarm}{\\boldsymbol{r}}
\\newcommand{\\zrobotwrench}{\\boldsymbol{w}}
\\newcommand{\\zrobotforcedirection}{\\boldsymbol{d}}
\\newcommand{\\zrobotforcemagnitude}{f}
\\newcommand{\\zrobotforcevector}{\\boldsymbol{f}^{robot}}
\\newcommand{\\zrobotvelox}{v_{x,r}}
\\newcommand{\\zrobotveloy}{v_{y,r}}
\\newcommand{\\zrobotvelotheta}{\\omega_{r}}
\\newcommand{\\zrobotoccupiedarea}{\\mathcal{A}_{r}}

\\newcommand{\\zrobotforcesetidx}[1]{\\mathcal{F}_{#1}}
\\newcommand{\\zrobotforceidx}[1]{\\boldsymbol{f}_{#1}}
\\newcommand{\\znormalmagidx}[1]{f_{n,#1}}
\\newcommand{\\ztangentmagidx}[1]{f_{t,#1}}
\\newcommand{\\zcontrol}[1]{\\mathbf{u}_{\\ifblank{#1}{}{#1}}}

\\newcommand{\\zdisturbance}{\\boldsymbol{d}_{disturbance}}
\\newcommand{\\zjacobian}{\\boldsymbol{J}}
\\newcommand{\\zgravity}{\\boldsymbol{g}}
\\newcommand{\\zobstacles}{\\mathcal{O}}
\\newcommand{\\ztaskspace}[1]{\\mathcal{R}^{#1}}

\\newcommand{\\zfrictionlateral}{\\mu_{lateral}}
\\newcommand{\\zfrictionforce}{\\mu}
\\newcommand{\\zfrictiontorque}{\\mu_{torque}}
\\newcommand{\\zfrictionground}{\\mu_{ground}}
\\newcommand{\\znormalf}{\\boldsymbol{f_n}}
\\newcommand{\\ztangentf}{\\boldsymbol{f_t}}
\\newcommand{\\zfrictionwrenchspace}{\\mathcal{W}_{fric}}
\\newcommand{\\zlsfmax}{f_{\\max}^{LS}}
\\newcommand{\\zlsmmax}{m_{\\max}^{LS}}
\\newcommand{\\zlsshapeparameter}{c}

\\newcommand{\\zappforcex}{F_{app, x}}
\\newcommand{\\zappforcey}{F_{app, y}}
\\newcommand{\\zappmoment}{M_{app}}
\\newcommand{\\znetforce}{\\boldsymbol{F}_{net}}
\\newcommand{\\znetforcex}{\\boldsymbol{F}_{net,x}}
\\newcommand{\\znetforcey}{\\boldsymbol{F}_{net,y}}
\\newcommand{\\znettorque}{\\boldsymbol{\\tau}_{net}}
\\newcommand{\\znetwrench}{\\boldsymbol{W}_{net}}
\\newcommand{\\znetwrenchspace}{\\mathcal{W}_{net}}

\\newcommand{\\zobjtwist}{\\boldsymbol{v}^{*}_{\\mathcal{O}}}
\\newcommand{\\zobjomega}{\\omega^{*}_{\\mathcal{O}}}
\\newcommand{\\zcontactvelo}[1]{\\boldsymbol{v}_{c,#1}^{*}}
\\newcommand{\\zcontactnormal}[1]{\\hat{\\boldsymbol{n}}_{#1}}
\\newcommand{\\zcontacttangent}[1]{\\hat{\\boldsymbol{\\tau}}_{#1}}
\\newcommand{\\zvpar}[1]{v_{\\parallel,#1}}
\\newcommand{\\zvperp}[1]{v_{\\perp,#1}}
\\newcommand{\\zwheelvelo}[1]{\\omega_{#1}^{\\mathrm{wheel}}}

\\newcommand{\\zafcthreshold}{T}
\\newcommand{\\zhwscalar}{\\lambda}
\\newcommand{\\zdegenindex}{D}
\\newcommand{\\zeigval}[1]{\\sigma_{#1}}
\\newcommand{\\zkappa}{\\kappa}

\\newcommand{\\zforcebound}{f_{\\max}}
\\newcommand{\\zforcethreshold}{F_{\\mathrm{threshold}}}
\\newcommand{\\zforcestatic}{F_{\\mathrm{static}}}
\\newcommand{\\zgrasp}{\\boldsymbol{G}}
\\newcommand{\\zgraspcol}[1]{\\boldsymbol{g}_{#1}}
\\newcommand{\\zforcevector}{\\boldsymbol{f}^{r}}
\\newcommand{\\zcumulativewrench}{\\boldsymbol{W}_{push}}
\\newcommand{\\zfrictionwrench}{\\boldsymbol{W}_{fric}}
\\newcommand{\\zwrenchspace}{\\mathcal{W}}
\\newcommand{\\zconfig}{C}
\\newcommand{\\zreqwrench}{\\boldsymbol{W}_{req}}
\\newcommand{\\zcontactpoints}{\\mathcal{C}}
\\newcommand{\\zcontactpointstotal}{N_c}
\\newcommand{\\zcontactpoint}{cp}

\\newcommand{\\zlocalframe}{\\mathcal{L}}
\\newcommand{\\zglobalframe}{\\mathcal{G}}
\\newcommand{\\zoriginalworkspace}{\\mathcal{W}_0}
\\newcommand{\\zworkspace}{\\mathcal{W}}
\\newcommand{\\zfreespace}{\\mathcal{F}_{\\mathrm{free}}}

\\newcommand{\\zpath}{\\mathcal{P}}
\\newcommand{\\zpathparam}{\\mathcal{T}}
\\newcommand{\\zpathparamvelo}{v^{p}}
\\newcommand{\\zhorizon}{T}
\\newcommand{\\zpathlength}{L_{\\mathcal{P}}}
\\newcommand{\\zpathx}{x_{\\mathcal{P}}}
\\newcommand{\\zpathy}{y_{\\mathcal{P}}}
\\newcommand{\\zpaththeta}{\\theta_{\\mathcal{P}}}
\\newcommand{\\zpathtangent}{d_{\\mathcal{P}}}
\\newcommand{\\zcrosstrack}{e_{cross}}
\\newcommand{\\zalongtrack}{e_{along}}
\\newcommand{\\zsamplingtime}{\\Delta t}
\\newcommand{\\zcostfunction}{J}
\\newcommand{\\zweight}{w}

\\newcommand{\\zedgeparam}{t}
\\newcommand{\\zedgestart}{\\boldsymbol{p}_{start}}
\\newcommand{\\zedgedirection}{\\boldsymbol{d}_{edge}}
\\newcommand{\\zedgenormal}{\\boldsymbol{n}}
\\newcommand{\\zedgetangent}{\\boldsymbol{t}}
\\newcommand{\\znormalmag}{\\alpha}
\\newcommand{\\ztangentmag}{\\beta}
\\newcommand{\\zedgeactive}{n_{E}}
\\newcommand{\\zedgelimit}{N_{\\max}}

\\newcommand{\\zrr}{\\mathbb{R}^2}
\\newcommand{\\zrrr}{\\mathbb{R}^3}
\\newcommand{\\zse}{\\mathrm{SE}(2)}
`;

export const DEFAULT_PLOT_OPTIONS: PlotOptions = {
  showGrid: true,
  gridStyle: 'dotted',
  gridResolution: 1.0,
  showAxis: true,
  showAxisLabels: true,
  xLabel: '$x$ [m]',
  yLabel: '$y$ [m]',
  title: 'Robotics Scene Layout',
  fontSize: 12,
  backgroundColor: '#ffffff',
  bgOpacity: 1.0,
  labelBoxOpacity: 0.0,
  scaleLabelsWithZoom: true,
  renderMathOnCanvas: true,
  cropToContent: false,
  cropPadding: 0.05,
  marginPadding: 0.05,
  showPlotBorder: true,
  grabHandleRadius: 14,
  activeWorkspaceTab: 'main_scene',
  showLeftSidebar: true,
  showRightPanel: true,
};

export const PRESET_ROBOTS: Record<string, RobotDefinition> = {
  diff_drive_bot: {
    id: 'diff_drive_bot',
    name: 'Differential Drive Bot',
    primitives: [
      { id: 'chassis', type: 'circle', config: { radius: 35, strokeColor: '#3b82f6', fillColor: '#dbeafe' } },
      { id: 'heading_line', type: 'vector', config: { points: [0, 0, 45, 0], strokeColor: '#ef4444' } },
      { id: 'left_wheel', type: 'rect', config: { x: -10, y: -34, width: 20, height: 8, fillColor: '#1e293b' } },
      { id: 'right_wheel', type: 'rect', config: { x: -10, y: 34, width: 20, height: 8, fillColor: '#1e293b' } },
    ],
  },
  root_robot: {
    id: 'root_robot',
    name: 'Root Footprint Shape',
    primitives: [
      {
        id: 'root_poly',
        type: 'poly',
        config: {
          vertices: [
            [19, -26], [92, -26], [92, -7], [34, -7], [11, 60],
            [-13, 60], [-45, -23], [-79, -23], [-79, -45], [-32, -45], [-1, 36]
          ],
          strokeColor: '#10b981',
          fillColor: '#d1fae5',
        },
      },
    ],
  },
  right_triangle: {
    id: 'right_triangle',
    name: 'Right Triangle Shape',
    primitives: [
      {
        id: 'tri_poly',
        type: 'poly',
        config: {
          vertices: [
            [-23, -25], [46, -25], [-23, 50]
          ],
          strokeColor: '#8b5cf6',
          fillColor: '#ede9fe',
        },
      },
    ],
  },
  pi_shape: {
    id: 'pi_shape',
    name: 'Pi Symbol Shape',
    primitives: [
      {
        id: 'pi_poly',
        type: 'poly',
        config: {
          vertices: [
            [-70, -40], [64, -40], [64, -5], [44, -5], [44, 89],
            [24, 89], [24, -5], [-20, -5], [-20, 44], [-50, 44],
            [-50, -5], [-70, -5]
          ],
          strokeColor: '#ec4899',
          fillColor: '#fce7f3',
        },
      },
    ],
  },
  meteor_shape: {
    id: 'meteor_shape',
    name: 'Meteor Polygon',
    primitives: [
      {
        id: 'meteor_poly',
        type: 'poly',
        config: {
          vertices: [
            [-36, -115], [63, -75], [82, -45], [63, 34], [32, 77],
            [3, 84], [-36, 84], [-86, 4], [-86, -45]
          ],
          strokeColor: '#f97316',
          fillColor: '#ffedd5',
        },
      },
    ],
  },
  hourglass_shape: {
    id: 'hourglass_shape',
    name: 'Hourglass Polygon',
    primitives: [
      {
        id: 'hg_poly',
        type: 'poly',
        config: {
          vertices: [
            [49, -50], [10, 0], [50, 49], [-49, 49], [-10, 0], [-49, -50]
          ],
          strokeColor: '#06b6d4',
          fillColor: '#cffaff',
        },
      },
    ],
  },
};

export const INITIAL_LAYOUT: ProjectLayout = {
  macros: {},
  definitions: PRESET_ROBOTS,
  plotOptions: DEFAULT_PLOT_OPTIONS,
  exportBounds: {
    xMin: -10,
    yMin: -10,
    xMax: 10,
    yMax: 10,
  },
  scene: [
    {
      id: 'node_robot_1',
      name: 'Robot 1',
      type: 'alias',
      definitionId: 'diff_drive_bot',
      x: -3,
      y: 2,
      scale: 1.0,
      rotation: 30,
      label: '',
      style: {
        strokeWidth: 2,
        strokeStyle: 'solid',
        color: '#3b82f6',
        fillColor: '#93c5fd',
      },
    },
    {
      id: 'node_robot_2',
      name: 'Robot 2',
      type: 'alias',
      definitionId: 'root_robot',
      x: 3,
      y: -2,
      scale: 1.2,
      rotation: -45,
      label: '',
      style: {
        strokeWidth: 2,
        strokeStyle: 'solid',
        color: '#10b981',
        fillColor: '#a7f3d0',
      },
    },
    {
      id: 'node_obs_1',
      name: 'Obstacle Box',
      type: 'obstacle',
      x: 0,
      y: -5,
      scale: 1.0,
      rotation: 0,
      width: 4,
      height: 2,
      label: '',
      style: {
        strokeWidth: 2,
        strokeStyle: 'dashed',
        color: '#f59e0b',
        fillColor: '#fef3c7',
      },
    },
    {
      id: 'node_vector_1',
      name: 'Force Vector',
      type: 'vector',
      x: -3,
      y: 2,
      scale: 1.0,
      rotation: 0,
      points: [0, 0, 4, 3],
      label: '',
      style: {
        strokeWidth: 3,
        strokeStyle: 'solid',
        color: '#ef4444',
      },
    },
  ],
};
