<template>
    <section id="classifier" v-if="currentItem">
        <h4 class="statusbar">
            id: {{ currentItem.id }} | created: {{ createdFormatted }} |&nbsp;
            modified: {{ modifiedFormatted }} | status: {{ currentItem.status }} |&nbsp;
            db: {{ currentItem.databases.join(", ") }}
        </h4>

        <h1>{{ currentItem.title }}</h1>
        <p class="author">
            <small>{{ currentItem.author }}</small>
        </p>
        <p class="publication">
            <a :href="currentItem.url">In publisher database</a> |&nbsp;
            <span v-if="currentItem.Publication">{{ currentItem.Publication.name }}, jufo-level: {{
                currentItem.Publication.jufoLevel }}</span>
        </p>
        <p v-if="!currentItem.abstract">
            <small>
                <b>Short description:</b>
            </small>
            <br />
            {{ currentItem.description }}
        </p>

        <div class="abstract-wrapper" :settings="{}" :style="{ paddingBottom: abstractPaddingBottom }">
            <p v-if="currentItem.abstract" class="abstract">
                <small>
                    <b>Abstract:</b>
                </small>
                <br />
                <span v-html="nltobr(sanitizeAbstract(currentItem.abstract))"></span>
            </p>
        </div>

        <section class="bottom-bar">
            <div class="bottom-bar__center">
                <div class="bottom-bar__actions">
                    <textarea :value="currentItem.comment" @input="setComment" @focus="setMoveLock" @blur="unsetMoveLock"
                        class="comment" type="text" rows="3" placeholder="Write your comments here..."></textarea>

                    <div class="inclusion-actions" v-if="tab === 'inc-exc'">
                        <button @click="setExcluded" :class="[currentItem.status === 'excluded' && 'action--selected']"
                            class="action action--exclude">Exclude</button>
                        <button @click="setUncertain" :class="[currentItem.status === 'uncertain' && 'action--selected']"
                            class="action action--uncertain">Uncertain</button>
                        <button @click="setIncluded" :class="[currentItem.status === 'included' && 'action--selected']"
                            class="action action--include">Include</button>
                    </div>

                    <mapping-actions v-if="tab === 'map'"></mapping-actions>
                </div>
            </div>
        </section>
    </section>
</template>


<script>
import { mapState, mapActions } from "pinia";
import { defaultStore } from '../stores/default';
import MappingActions from "./MappingActions.vue";
import { format as formatDate } from "date-fns";
import { debounce } from "lodash";
import { keyCodes } from "../helpers/utils";

export default {
    name: "Classifier",
    components: {
        MappingActions,
    },
    data() {
        return {
            commentFocus: false,
        };
    },
    computed: {
        ...mapState(defaultStore, [
            "pageItems",
            "pageLength",
            "page",
            "statusFilter",
            "tab",
            "moveLock",
            "mappingQuestions",
            "currentItem"
        ]),
        abstractPaddingBottom() {
            return this.tab === "map" ? `${this.mappingQuestions.length * 35}px` : 0;
        },
        createdFormatted() {
            if (!this.currentItem) {
                return null;
            }
            return formatDate(
                new Date(this.currentItem.createdAt),
                "dd.MM.yyyy HH:mm:ss "
            );
        },
        modifiedFormatted() {
            if (!this.currentItem) {
                return null;
            }
            return formatDate(
                new Date(this.currentItem.updatedAt),
                "dd.MM.yyyy HH:mm:ss "
            );
        },
        nextFlag() {
            if (!this.currentItem) {
                return false;
            }
            const { status } = this.currentItem;
            return (
                (status === null && this.statusFilter === "null") ||
                status === this.statusFilter
            );
        },
    },
    created() {
        window.addEventListener("keydown", this.moveTo);
    },
    unmounted() {
        window.removeEventListener("keydown", this.moveTo);
    },
    methods: {
        ...mapActions(defaultStore, [
            "setItemStatus",
            "setItemComment",
            "setCurrentItem",
            "setPage",
            "setMoveLock",
            "unsetMoveLock",
        ]),
        async setExcluded() {
            await this.setItemStatus("excluded");
            this.setNextItem(this.nextFlag);
        },
        async setUncertain() {
            await this.setItemStatus("uncertain");
            this.setNextItem(this.nextFlag);
        },
        async setIncluded() {
            await this.setItemStatus("included");
            this.setNextItem(this.nextFlag);
        },
        setComment(e) {
            const id = this.currentItem.id;
            const val = e.target.value;
            this.debouncedSetComment(id, val)
        },
        debouncedSetComment: debounce(async function (id, val) {
                await this.setItemComment(id, val);
            }, 1000),
        setNextItem(skip) {
            if (skip) {
                return;
            }
            const index = this.pageItems.findIndex(
                (item) => item.id === this.currentItem.id
            );
            if (index >= this.pageLength - 1) {
                this.setPage(this.page + 1);
            } else {
                this.setCurrentItem(this.pageItems[index + 1]);
            }
        },
        async setPrevItem() {
            const index = this.pageItems.findIndex(
                (item) => item.id === this.currentItem.id
            );
            if (index <= 0 && this.page > 1) {
                await this.setPage(this.page - 1);
                this.setCurrentItem(this.pageItems[this.pageItems.length - 1]);
            } else if (index > 0) {
                this.setCurrentItem(this.pageItems[index - 1]);
            }
        },
        nltobr(str) {
            return str.replace(/(?:\r\n|\r|\n)/g, "<br>");
        },
        sanitizeAbstract(str) {
            let res = str.replace("Abstract:\n", "").replace("Abstract\n", "");
            return res.split("\n•\n").join("");
        },
        moveTo(e) {
            if (!this.moveLock) {
                switch (e.keyCode) {
                    case keyCodes.ARROW_LEFT:
                        this.setPrevItem();
                        break;
                    case keyCodes.ARROW_RIGHT:
                        this.setNextItem();
                        break;
                    default:
                }
            }
        },
    },
};
</script>
<style scoped lang="scss">
#classifier {
    margin-left: 20px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
}

h1 {
    margin: 20px 0 10px;
}

.abstract {
    line-height: 32px;
    font-family: Georgia;
    font-size: 18px;
    margin: 0;
}

.abstract-wrapper {
    flex: 1;
    position: relative;
}

.inclusion-actions {
    margin-top: 5px;
    display: flex;
    padding: 5px;

    .action {
        flex: 1;
        height: 32px;
        font-size: 20px;
        background: #c0c0c0;
        border: 0;
        box-shadow: inset 0 0 1px rgba(0, 0, 0, 0.7), 0 2px 3px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        text-shadow: 1px 1px rgba(255, 255, 255, 0.7);
        font-family: Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;

        +.action {
            margin-left: 5px;
        }

        &--exclude {
            background: rgb(255, 180, 180);
            background: linear-gradient(180deg,
                    rgba(255, 180, 180, 1) 0%,
                    rgb(182, 143, 143) 100%);
            color: #592f2f;
        }

        &--uncertain {
            background: #ffffb4;
            background: linear-gradient(180deg, #ffffb4 0%, #baba72 100%);
            color: #464208;
        }

        &--include {
            background: #c4ffb4;
            background: linear-gradient(180deg, #c4ffb4 0%, #89b57d 100%);
            color: #1d4612;
        }

        &--selected,
        &:active,
        &:focus {
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.6);
            color: #fff;
            outline: none;
        }

        &--selected.action--exclude,
        &--exclude:active {
            background: linear-gradient(180deg,
                    rgb(143, 106, 106) 0%,
                    rgb(211, 151, 151) 100%);
            box-shadow: inset 0 0 1px #111111e9, inset 0px 2px 4px rgba(0, 0, 0, 0.4),
                inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }

        &--selected.action--include,
        &--include:active {
            background: linear-gradient(180deg, #719766 0%, #aadc9d 100%);
            box-shadow: inset 0 0 1px #111111e9, inset 0px 2px 4px rgba(0, 0, 0, 0.4),
                inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }

        &--selected.action--uncertain,
        &--uncertain:active {
            background: linear-gradient(180deg, #a6a656 0%, #d7d78e 100%);
            box-shadow: inset 0 0 1px #111111e9, inset 0px 2px 4px rgba(0, 0, 0, 0.4),
                inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }
    }
}

.comment {
    padding: 5px;
    border: none;
    border-bottom: 1px solid #eaeaea;
    // box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
    margin: 5px 0;
    transition: background-color 0.2s ease-in, box-shadow 0.2s ease-in;
    font-size: 14px;
    font-family: Georgia, "Times New Roman", Times, serif;
    resize: vertical;

    &:focus,
    &:hover {
        outline: none;
        box-shadow: none;
        background-color: #eaeaea;
    }
}

.publication {
    margin-top: 0;
    padding-bottom: 10px;
    border-bottom: 3px solid #eaeaea;
}

.author {
    margin-top: 0;
}

.bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    pointer-events: none;

    &__center {
        max-width: 1200px;
        margin: 0 auto;
        pointer-events: none;
    }

    &__actions {
        display: flex;
        flex-direction: column;
        margin-left: 230px;
        background: #fff;
        padding-bottom: 5px;
        position: relative;
        border-top: 3px solid #eaeaea;
        pointer-events: auto;

        &:after {
            content: "";
            width: 100%;
            height: 1px;
            background: #fff;
            position: absolute;
            top: -4px;
        }
    }
}

.color-uncertain {
    color: #cece13;
}

.color-excluded {
    color: #ffb4b4;
}

.color-included {
    color: #52df2c;
}

.statusbar {
    margin: 6px 0 0;
    background: #f7f7f7;
    padding: 3px 5px;
    color: #5b5858;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 400;
}
</style>