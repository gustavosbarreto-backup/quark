// @flow
import { Record } from "immutable";
import Message from "../Message";
import type Cursor from "./Cursor";
import Action from "./Action";

export type State = "before" | "triggers" | "error" | "done" | "cancel" | "progress" | "finished" | "waiting";

type PendingActionData = {
    message:      Message, // eslint-disable-line
    state?:       ?State,  // eslint-disable-line
    willTrigger?: boolean,
    description?: ?Action, // eslint-disable-line
    previous?:    ?Action, // eslint-disable-line
    error?:       ?Error   // eslint-disable-line
};

export default class PendingAction extends Record({
    message:     null,
    state:       "before",
    willTrigger: false,
    description: null,
    trigger:     null,
    previous:    null,
    error:       null
}) {
    constructor(data: PendingActionData) {
        super(data);
    }

    finish(): PendingAction {
        return this
            .set("description", null)
            .set("trigger", null)
            .set("previous", null)
            .set("error", null)
            .changeState("finished");
    }

    before(action: Action, message: Message): PendingAction { // eslint-disable-line
        const prev0   = this.description ? `${this.name}.${this.state}` : action.name;
        const prev    = this.description.name === action.name ? prev0.replace(".before", "") : prev0;
        const trigger = action.triggerFor(prev);

        return this
            .set("message", message.preparePayload(trigger))
            .set("trigger", trigger)
            .set("description", action)
            .set("previous", this.description)
            .changeState("before");
    }

    // hier en result rein
    done(): PendingAction {
        // hier muss der caller geändert werden
        return this
            .changeState("done");
    }

    // hier den error rein un das errohandling hierhin bauen
    // das hier kann auch die traces halten, dann kann man hier die ganzen
    // trace handler reinballern
    error(error?: ?Error = null): PendingAction {
        return this
            .set("error", error)
            .changeState("error");
    }

    triggers(): PendingAction {
        return this.changeState("triggers");
    }

    cursorChanged(cursor: Cursor): PendingAction {
        return this
            .update("message", message => message instanceof Message ? message.setCursor(cursor) : message);
    }

    changeState(state: State): PendingAction {
        return this.set("state", state);
    }

    get name(): string { // eslint-disable-line
        if(this.trigger && this.trigger !== null)         return this.trigger.emits;
        if(this.previous && this.previous !== null)       return this.previous.name;
        if(this.description && this.description !== null) return this.description.name;

        return this.message.currentDir;
    }

    get op(): ?Function {
        return this.description !== null ? this.description.op : null;
    }

    get delay(): number {
        return this.trigger !== null ? this.trigger.delay : 0;
    }
}
