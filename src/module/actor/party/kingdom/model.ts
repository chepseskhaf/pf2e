import { FeatGroup } from "@actor/character/feats.ts";
import { ItemType } from "@item/data/index.ts";
import { createHTMLElement, fontAwesomeIcon } from "@util";
import { ModelPropsFromSchema } from "types/foundry/common/data/fields.js";
import type { PartyPF2e } from "../document.ts";
import { PartyCampaign } from "../types.ts";
import { KingdomBuilder } from "./builder.ts";
import { KingdomCHG, KingdomGovernment, KingdomSchema, KingdomSource } from "./data.ts";
import { resolveKingdomBoosts } from "./helpers.ts";
import { KINGDOM_SCHEMA } from "./schema.ts";
import { KINGDOM_ABILITIES } from "./values.ts";

const { DataModel } = foundry.abstract;

/** Model for the Kingmaker campaign data type, which represents a Kingdom */
class Kingdom extends DataModel<PartyPF2e, KingdomSchema> implements PartyCampaign {
    declare feats: FeatGroup<PartyPF2e>;
    declare bonusFeats: FeatGroup<PartyPF2e>;

    static override defineSchema(): KingdomSchema {
        return KINGDOM_SCHEMA;
    }

    get actor(): PartyPF2e {
        return this.parent;
    }

    get extraItemTypes(): ItemType[] {
        return ["action", "feat"];
    }

    get charter(): KingdomCHG | null {
        return this.build.charter;
    }

    get heartland(): KingdomCHG | null {
        return this.build.heartland;
    }

    get government(): KingdomGovernment | null {
        return this.build.government;
    }

    override _initialize(options?: Record<string, unknown>): void {
        super._initialize(options);
        this.prepareAbilityScores();
        this.prepareFeats();
    }

    /** Creates sidebar buttons to inject into the chat message sidebar */
    createSidebarButtons(): HTMLElement[] {
        // Do not show kingdom to party members until it becomes activated.
        if (!this.active && !game.user.isGM) return [];

        const crownIcon = fontAwesomeIcon("crown");
        const icon = createHTMLElement("a", { classes: ["create-button"], children: [crownIcon] });
        if (!this.active) {
            icon.appendChild(fontAwesomeIcon("plus"));
        }

        icon.addEventListener("click", () => {
            // todo: open actual kingdom sheet once active
            new KingdomBuilder(this).render(true);
        });
        return [icon];
    }

    async update(data: DeepPartial<KingdomSource> & Record<string, unknown>): Promise<void> {
        await this.actor.update({ "system.campaign": data });
    }

    private prepareAbilityScores(): void {
        if (this.build.manual) return;

        for (const ability of KINGDOM_ABILITIES) {
            this.abilities[ability].value = 10;
        }

        // Charter/Heartland/Government boosts
        for (const category of ["charter", "heartland", "government"] as const) {
            const data = this.build[category];
            const chosen = this.build.boosts[category];
            if (!data) continue;

            if (data.flaw) {
                this.abilities[data.flaw].value -= 2;
            }

            const activeBoosts = resolveKingdomBoosts(data, chosen);
            for (const ability of activeBoosts) {
                this.abilities[ability].value += this.abilities[ability].value >= 18 ? 1 : 2;
            }
        }

        // Level boosts
        const activeLevels = ([1, 5, 10, 15, 20] as const).filter((l) => this.level >= l);
        for (const level of activeLevels) {
            const chosen = this.build.boosts[level].slice(0, 2);
            for (const ability of chosen) {
                this.abilities[ability].value += this.abilities[ability].value >= 18 ? 1 : 2;
            }
        }
    }

    private prepareFeats(): void {
        const { actor } = this;

        const evenLevels = new Array(actor.level)
            .fill(0)
            .map((_, idx) => idx + 1)
            .filter((idx) => idx % 2 === 0);

        this.feats = new FeatGroup(actor, {
            id: "kingdom",
            label: "Kingdom Feats",
            slots: evenLevels,
            featFilter: ["traits-kingdom"],
        });

        this.bonusFeats = new FeatGroup(actor, {
            id: "bonus",
            label: "PF2E.FeatBonusHeader",
            featFilter: ["traits-kingdom"],
        });

        for (const feat of this.actor.itemTypes.feat) {
            if (!this.feats.assignFeat(feat)) {
                this.bonusFeats.assignFeat(feat);
            }
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Kingdom extends ModelPropsFromSchema<KingdomSchema> {}

export { Kingdom };
