import { NoxisApp } from "@/components/noxis/noxis-app"
import { UIModeLoader } from "@/components/noxis/ui-mode-loader"

export default function Home() {
  return (
    <UIModeLoader>
      <NoxisApp />
    </UIModeLoader>
  )
}
