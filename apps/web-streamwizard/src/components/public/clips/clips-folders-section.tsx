import { Folder, FolderOpen, Play } from "lucide-react";
import { cn } from "@repo/ui";
import { SectionView } from "../analytics/section-view";
import { Reveal } from "../home/reveal";

/*
 * The depth story the interactive mock above skims past: nesting has no
 * floor and one clip sits in many folders. The tree is a static sketch on
 * purpose; the playable version is the ClipFoldersMock at the top of the
 * page.
 */

function TreeRow({
  depth,
  open,
  clip,
  badge,
  children,
}: {
  depth: number;
  open?: boolean;
  clip?: boolean;
  badge?: string;
  children: string;
}) {
  const Icon = clip ? Play : open ? FolderOpen : Folder;
  return (
    <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${depth * 20}px` }}>
      <Icon
        className={cn("size-3.5 shrink-0", clip ? "text-muted-foreground" : "text-purple-400")}
        aria-hidden="true"
      />
      <span className={cn("truncate text-sm", clip ? "text-muted-foreground" : "text-foreground")}>{children}</span>
      {badge ? (
        <span className="shrink-0 rounded-full border border-purple-400/30 bg-purple-400/[0.08] px-2 py-px font-mono text-[10px] text-purple-300">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

export function ClipsFoldersSection() {
  return (
    <section id="clip-folders" className="scroll-mt-24 py-20">
      <SectionView section="clips_folders" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Folders</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Folders in folders, as deep as the chaos goes.</h2>
          <p className="mt-4 text-muted-foreground">
            Build the tree your library actually needs, then file each clip wherever it fits.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <Reveal direction="left">
            <div>
              <h3 className="text-xl font-semibold">One clip, five folders if you want.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Filing a clip does not move or copy it. The ace sits in Chat lost it and in Best of
                2026 at once, and Remove from folder takes it back out. Folders hold exactly what
                you put in them; no algorithm reshuffles your library overnight.
              </p>
            </div>
          </Reveal>
          <Reveal direction="right">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
              <TreeRow depth={0} open>Valorant</TreeRow>
              <TreeRow depth={1} open>Aces</TreeRow>
              <TreeRow depth={2} open>Chat lost it</TreeRow>
              <TreeRow depth={3} clip>the 1v5 on Ascent</TreeRow>
              <TreeRow depth={1}>Fails</TreeRow>
              <TreeRow depth={0}>IRL walks</TreeRow>
              <TreeRow depth={0} open>Best of 2026</TreeRow>
              <TreeRow depth={1} clip badge="same clip">the 1v5 on Ascent</TreeRow>
            </div>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
