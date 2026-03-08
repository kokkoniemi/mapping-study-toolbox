<template>
    <div class="mapping-actions">
        <div v-for="(question, i)  in mappingQuestions" class="mapping-question" :key="question.id">
            <div class="mapping-question__title" @click="(e) => setQuestionPopupActive(e, question.id)">
                <div class="mapping-question__popup" v-if="activeQuestionPopup === question.id">
                    <div class="mapping-question__popup--backdrop" @click="setQuestionPopupInactive"></div>
                    <div class="mapping-question__popup--content">
                        <div v-if="activeQuestionConfirm" class="mapping-question__popup--confirm">
                            <h3>Are you sure?</h3>
                            <button @click="() => deleteQuestion(question.id)" class="button--danger">Delete</button>
                            <button @click="activeQuestionConfirm = false">Cancel</button>
                        </div>
                        <label>Title</label>
                        <input type="text" :value="question.title" @input="(e) => setQuestionTitle(e, question)" />

                        <label>Type</label>
                        <select @change="() => null">
                            <option v-for="(o) in typeOptions" :value="o.value">{{ o.label }}</option>
                        </select>
                        <!-- <v-select @input="() => null" :options="typeOptions" :value="typeOptions[0].label"
                            :clearable="false" :searchable="false" disabled></v-select> -->

                        <label>Position</label>
                        <div class="mapping-question__popup--position">
                            <div class="question-position--up" @click="() => decreaseQuestionPosition(question, i)">
                                <span class="icon">–</span>
                            </div>
                            <div class="question-position">{{ question.position }}</div>
                            <div class="question-position--down" @click="() => increaseQuestionPosition(question, i)">
                                <span class="icon">+</span>
                            </div>
                        </div>
                        <button @click="activeQuestionConfirm = true">Delete question</button>
                    </div>
                </div>
                <span class="icon">{{ getIcon(question.type) }}</span>
                {{ question.title }}
            </div>
            <div :class="{ 'mapping-question__tags--active': activeOptionPopup === question.id }"
                class="mapping-question__value mapping-question__tags" @click="(e) => setOptionPopupActive(e, question.id)">
                <div class="mapping-question__tags--popup" v-if="activeOptionPopup === question.id">
                    <div @click="setOptionPopupInactive" class="mapping-question__popup--backdrop"></div>
                    <div class="mapping-question__tags--popup-content">
                        <ul class="mapping-question__tags--list">
                            <li @click="() => createOption(question, nextOptionColor)"
                                class="mapping-question__tags--list-item" v-if="optionInput.length">
                                <div class="mapping-question__tags--create">Create:</div>
                                <span class="mapping-question__tags--tag" :style="{ backgroundColor: nextOptionColor }">{{
                                    optionInput }}</span>
                            </li>
                            <li v-for="option in question.MappingOptions.filter(filterOptionList)" :key="option.id"
                                class="mapping-question__tags--list-item"
                                @click="() => addRecordMappingOption({ mappingQuestionId: question.id, mappingOptionId: option.id })">
                                <span class="mapping-question__tags--tag" :style="{ backgroundColor: option.color }">{{
                                    option.title }}</span>
                            </li>
                        </ul>
                        <div class="hint">Select an option or create one</div>
                    </div>
                </div>
                <!-- per record options -->
                <div class="mapping-question__tags">
                    <span v-for="option in currentItem.MappingOptions.filter(o => o.mappingQuestionId === question.id)"
                        :key="option.id" class="mapping-question__tags--tag" :style="{ backgroundColor: option.color }"
                        @click="() => removeRecordMappingOption(option.id)">
                        {{ option.title }}
                        <span class="icon" v-if="activeOptionPopup === question.id">⊗</span>
                    </span>
                </div>
                <input v-if="activeOptionPopup === question.id" type="text" ref="newOption" v-model="optionInput" />
            </div>
        </div>
        <div class="mapping-question mapping-question--new">
            <div class="mapping-question__title" @click="newMappingQuestion">
                <span class="icon">+</span> New mapping question
            </div>
        </div>
    </div>
</template>

<script>
import { mapActions, mapState } from "pinia";
import { defaultStore } from '../stores/default';
import { debounce } from "../helpers/utils";

export default {
    name: "MappingActions",
    data() {
        return {
            typeOptions: [{ label: "Multi-select", value: "multiSelect" }],
            activeOptionPopup: null,
            activeQuestionPopup: null,
            activeQuestionConfirm: false,
            optionInput: "",
            nextOptionColor: "",
        };
    },
    computed: {
        ...mapState(defaultStore, ["mappingQuestions", "currentItem"]),
    },
    mounted() {
        this.fetchMappingQuestions();
        this.nextOptionColor = this.getOptionColor();
    },
    methods: {
        ...mapActions(defaultStore, [
            "fetchMappingQuestions",
            "createMappingQuestion",
            "deleteMappingQuestion",
            "updateMappingQuestion",
            "createMappingOption",
            "addRecordMappingOption",
            "removeRecordMappingOption",
            "setMoveLock",
            "unsetMoveLock",
        ]),
        getIcon(type) {
            return type === "multiSelect" ? "☰" : "";
        },
        setOptionPopupActive(event, id) {
            if (event.target.className !== "mapping-question__popup--backdrop") {
                this.activeOptionPopup = id;
                this.setMoveLock();
                this.$nextTick(() => {
                    this.$refs.newOption[0].focus();
                });
            }
        },
        setOptionPopupInactive() {
            this.activeOptionPopup = null;
            this.unsetMoveLock();
        },
        setQuestionPopupActive(event, id) {
            if (event.target.className !== "mapping-question__popup--backdrop") {
                this.activeQuestionPopup = id;
                this.setMoveLock();
            }
        },
        setQuestionPopupInactive() {
            this.activeQuestionPopup = null;
            this.activeQuestionConfirm = false;
            this.unsetMoveLock();
        },
        async newMappingQuestion() {
            await this.createMappingQuestion();
            this.activeQuestionPopup = this.mappingQuestions[
                this.mappingQuestions.length - 1
            ].id;
        },
        async deleteQuestion(id) {
            await this.deleteMappingQuestion(id);
            this.activeQuestionConfirm = false;
            this.activeQuestionPopup = null;
        },
        setQuestionTitle: debounce(async function (e, question) {
            const { id, type, position } = question;
            await this.updateMappingQuestion({
                id,
                title: e.target.value,
                type,
                position,
            });
        }, 1000),
        async increaseQuestionPosition(question, index) {
            if (
                this.mappingQuestions[this.mappingQuestions.length - 1].id ===
                question.id
            ) {
                return;
            }
            const { id, type, title, position } = question;
            await this.updateMappingQuestion({
                id,
                type,
                title,
                position: position + 1,
            });
            const next = this.mappingQuestions[index + 1];
            await this.updateMappingQuestion({
                id: next.id,
                type: next.type,
                title: next.title,
                position: next.position - 1,
            });
            await this.fetchMappingQuestions();
        },
        async decreaseQuestionPosition(question, index) {
            if (this.mappingQuestions[0].id === question.id) {
                return;
            }
            const { id, type, title, position } = question;
            await this.updateMappingQuestion({
                id,
                type,
                title,
                position: position - 1,
            });
            const prev = this.mappingQuestions[index - 1];
            await this.updateMappingQuestion({
                id: prev.id,
                type: prev.type,
                title: prev.title,
                position: prev.position + 1,
            });
            await this.fetchMappingQuestions();
        },
        async createOption(question, color) {
            await this.createMappingOption({
                id: question.id,
                title: this.optionInput,
                position: question.MappingOptions.length,
                color,
            });
            this.nextOptionColor = this.getOptionColor();
            this.optionInput = "";
        },
        getOptionColor() {
            const colors = [
                "#e6b0b0",
                "#e6cab0",
                "#e1e6b0",
                "#b0e6bf",
                "#9cdacd",
                "#96c9e1",
                "#a7adc6",
                "#b4a9ed",
                "#e2a9ed",
                "#e89dba",
                "#c69696",
            ];
            return colors[Math.floor(Math.random() * colors.length)];
        },
        filterOptionList(opt) {
            return (
                this.currentItem.MappingOptions.findIndex((o) => o.id === opt.id) ===
                -1 && opt.title.toLowerCase().includes(this.optionInput.toLowerCase())
            );
        },
    },
};
</script>
<style lang="scss" scoped>
.mapping-actions {
    display: flex;
    flex-direction: column;
    padding: 10px;

    .mapping-question {
        display: flex;
        flex-direction: row;
        min-height: 33px;

        &:last-of-type {
            .mapping-question__title {
                border-width: 0;
            }
        }

        &__title,
        &__value {
            transition: background-color 0.2s ease-in;
            display: flex;
            align-items: center;
            position: relative;

            &:hover {
                cursor: pointer;
                background-color: #eaeaea;
            }
        }

        &__title {
            padding: 5px;
            font-size: 12px;
            border: 0px solid #eaeaea;
            border-width: 0 1px 1px 0;
            width: 250px;

            .icon {
                padding: 0 5px;
                font-size: 18px;
                color: #949ea7;
            }
        }

        &__value {
            padding: 5px;
            border: 0px solid #eaeaea;
            border-width: 0 0 1px 0;
            flex: 1;
        }

        &__tags {
            &--tag {
                cursor: pointer;
                font-size: 10px;
                padding: 5px;
                border-radius: 3px;
                background-color: rgb(235, 213, 213);
                margin-right: 5px;
                position: relative;
                z-index: 2;
                font-weight: 600;
                color: rgba(0, 0, 0, 0.65);

                .icon {
                    font-size: 14px;
                    height: 18px;
                    width: 18px;
                    position: absolute;
                    right: -4px;
                    top: -5px;
                    color: rgb(235, 213, 213);
                    background: #820b0b;
                    border-radius: 50%;
                    display: none;
                }

                &:hover .icon {
                    display: inline-flex;
                    justify-content: center;
                    align-items: center;
                }
            }

            &--create {
                margin-right: 5px;
                font-size: 12px;
            }

            &--active {
                position: relative;

                * {
                    z-index: 2;
                }

                input {
                    border: 0;
                    flex: 1;
                    background: transparent;

                    &:focus {
                        border: 0;
                        outline: 0;
                    }
                }
            }

            &--popup-content {
                position: absolute;
                cursor: default;
                top: 0;
                left: 0;
                right: 0;
                transform: translateY(calc(-100% + 35px));
                background-color: #fff;
                border: 1px solid #aeaeae;
                padding: 10px 5px 35px;
                z-index: 1;
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);

                .hint {
                    font-size: 12px;
                    color: #c0c0c0;
                    border-bottom: 1px solid #eaeaea;
                    margin: 15px 5px 0;
                }
            }

            &--list {
                list-style: none;
                margin: 0;
                padding: 0;
                max-height: 300px;
                overflow-y: scroll;
                overflow-x: hidden;
            }

            &--list-item {
                cursor: pointer;
                height: 32px;
                display: flex;
                align-items: center;
                padding: 0 5px;
                margin: 0 -5px;
                transition: background-color 0.2s ease-in;

                &:hover {
                    background-color: #eaeaea;
                }
            }
        }

        &__popup {
            &--backdrop {
                position: fixed;
                cursor: default;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1;
                background-color: rgba(0, 0, 0, 0.2);
            }

            &--content {
                position: absolute;
                top: 0;
                background-color: #fff;
                min-width: 300px;
                border: 1px solid #aeaeae;
                padding: 0px 10px 10px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                z-index: 2;
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
                transform: translateY(-100%);

                button {
                    margin-top: 20px;
                }
            }

            &--confirm {
                text-align: center;
                padding: 10px;
                background-color: #fff;
                position: absolute;
                cursor: default;
                top: 0;
                left: 0;
                bottom: 0;
                right: 0;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                justify-content: center;
                z-index: 2;
            }

            &--position {
                display: flex;
                flex-direction: row;

                .question-position {
                    display: flex;
                    height: 24px;
                    align-items: center;
                    padding: 0 10px;

                    &--up,
                    &--down {
                        color: #2c3e50;
                        cursor: pointer;
                        background: #eaeaea;
                        height: 24px;
                        width: 24px;

                        .icon {
                            color: #2c3e50;
                            padding: inherit;
                            font-size: 24px;
                        }
                    }
                }
            }

            label {
                display: block;
                font-size: 12px;
                clear: both;
                padding: 5px 0;
                margin-top: 10px;
            }

            input {
                height: 24px;
                color: #2c3e50;
                font-size: 15px;
                padding-left: 7px;
                border: 1px solid #cecece;

                &:focus {
                    outline: unset;
                    box-shadow: none;
                    border: 1px solid #cecece;
                }
            }
        }

        &--new {
            color: #949ea7;
            font-weight: 600;

            .mapping-question__title,
            .mapping-question__title .icon {
                transition: color 0.2s ease-in;
            }

            .mapping-question__title {

                &:hover,
                &:hover .icon {
                    color: #2c3e50;
                }
            }
        }
    }
}
</style>
