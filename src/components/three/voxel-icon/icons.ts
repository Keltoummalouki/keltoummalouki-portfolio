// The icons the /about page's 3D companion builds out of voxels: one per chapter,
// the same Lucide icons the chapter list and the section headers show, so the
// shape on screen always names the section being read.
//
// Path data copied from lucide-react 0.513 (ISC License, Copyright (c) Lucide
// Contributors), on Lucide's 24×24 grid. Kept here as plain data instead of a deep
// import: it is rasterized at runtime (raster.ts), and the voxel versions are a
// stylized copy that does not need to follow future icon updates.

export type IconNodeElement =
  | readonly ['path', { readonly d: string }]
  | readonly ['circle', { readonly cx: string; readonly cy: string; readonly r: string }]
  | readonly ['rect', { readonly x: string; readonly y: string; readonly width: string; readonly height: string; readonly rx?: string }]
  | readonly ['line', { readonly x1: string; readonly y1: string; readonly x2: string; readonly y2: string }]

export type IconNode = readonly IconNodeElement[]

export const VOXEL_ICONS = {
  hand: [
    ['path', { d: 'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2' }],
    ['path', { d: 'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2' }],
    ['path', { d: 'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8' }],
    ['path', { d: 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' }],
  ],
  idCard: [
    ['path', { d: 'M16 10h2' }],
    ['path', { d: 'M16 14h2' }],
    ['path', { d: 'M6.17 15a3 3 0 0 1 5.66 0' }],
    ['circle', { cx: '9', cy: '11', r: '2' }],
    ['rect', { x: '2', y: '5', width: '20', height: '14', rx: '2' }],
  ],
  code: [
    ['path', { d: 'm18 16 4-4-4-4' }],
    ['path', { d: 'm6 8-4 4 4 4' }],
    ['path', { d: 'm14.5 4-5 16' }],
  ],
  briefcase: [
    ['path', { d: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }],
    ['rect', { x: '2', y: '6', width: '20', height: '14', rx: '2' }],
  ],
  graduationCap: [
    ['path', { d: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z' }],
    ['path', { d: 'M22 10v6' }],
    ['path', { d: 'M6 12.5V16a6 3 0 0 0 12 0v-3.5' }],
  ],
  layers: [
    ['path', { d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z' }],
    ['path', { d: 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12' }],
    ['path', { d: 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' }],
  ],
  award: [
    ['path', { d: 'm15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526' }],
    ['circle', { cx: '12', cy: '8', r: '6' }],
  ],
  gitBranch: [
    ['line', { x1: '6', y1: '3', x2: '6', y2: '15' }],
    ['circle', { cx: '18', cy: '6', r: '3' }],
    ['circle', { cx: '6', cy: '18', r: '3' }],
    ['path', { d: 'M18 9a9 9 0 0 1-9 9' }],
  ],
  languages: [
    ['path', { d: 'm5 8 6 6' }],
    ['path', { d: 'm4 14 6-6 2-3' }],
    ['path', { d: 'M2 5h12' }],
    ['path', { d: 'M7 2h1' }],
    ['path', { d: 'm22 22-5-10-5 10' }],
    ['path', { d: 'M14 18h6' }],
  ],
  usersRound: [
    ['path', { d: 'M18 21a8 8 0 0 0-16 0' }],
    ['circle', { cx: '10', cy: '8', r: '5' }],
    ['path', { d: 'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3' }],
  ],
  circleHelp: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }],
    ['path', { d: 'M12 17h.01' }],
  ],
  send: [
    ['path', { d: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z' }],
    ['path', { d: 'm21.854 2.147-10.94 10.939' }],
  ],
} as const satisfies Record<string, IconNode>

export type VoxelIconKey = keyof typeof VOXEL_ICONS

export const VOXEL_ICON_KEYS = Object.keys(VOXEL_ICONS) as VoxelIconKey[]
