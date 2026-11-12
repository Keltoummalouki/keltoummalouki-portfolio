import {
  Award,
  Briefcase,
  CircleHelp,
  CodeXml,
  GitBranch,
  GraduationCap,
  Hand,
  IdCard,
  Languages,
  Layers,
  Send,
  UsersRound,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'
import type { VoxelIconKey } from './icons'

/** The flat Lucide icon behind each voxel shape: for lists, headers and the no-WebGL stage. */
const GLYPHS: Record<VoxelIconKey, LucideIcon> = {
  hand: Hand,
  idCard: IdCard,
  code: CodeXml,
  briefcase: Briefcase,
  graduationCap: GraduationCap,
  layers: Layers,
  award: Award,
  gitBranch: GitBranch,
  languages: Languages,
  usersRound: UsersRound,
  circleHelp: CircleHelp,
  send: Send,
}

/** Decorative: always hidden from assistive technology (the text next to it says what it is). */
export function VoxelGlyph({ name, ...props }: LucideProps & { name: VoxelIconKey }) {
  const Glyph = GLYPHS[name]
  return <Glyph aria-hidden="true" focusable="false" {...props} />
}
