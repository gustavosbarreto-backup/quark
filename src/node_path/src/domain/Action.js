// @flow

import { List } from "immutable";
import Cursor from "./Cursor";
import assert from "assert";
import Message from "../Message";
import UnknownMessageError from "./error/UnknownMessageError";
import Trigger from "./Trigger";
import DeclaredTrigger from "./DeclaredTrigger";
import InvalidCursorError from "./error/InvalidCursorError";
import PendingAction from "./PendingAction";

type Kind    = "before" | "cancel" | "progress" | "done" | "error"; // eslint-disable-line
type Handler = (y?: Message) => Promise<Cursor>;

type ActionInput = {
    unit:     string,        // eslint-disable-line
    name:     string,        // eslint-disable-line
    op:       any,           // eslint-disable-line
    before:   List<Trigger>, // eslint-disable-line
    progress: List<Trigger>,
    cancel:   List<Trigger>, // eslint-disable-line
    done:     List<Trigger>, // eslint-disable-line
    error:    List<Trigger>, // eslint-disable-line
    triggers: List<Trigger>,
    func:     Handler        // eslint-disable-line
};

class Action {
    name:     string;         // eslint-disable-line
    op:       ?(* => Cursor); // eslint-disable-line
    before:   List<Trigger>;  // eslint-disable-line
    done:     List<Trigger>;  // eslint-disable-line
    triggers: List<Trigger>;
    error:    List<Trigger>;  // eslint-disable-line
    cancel:   List<Trigger>;  // eslint-disable-line
    progress: List<Trigger>;
    unit:     string;         // eslint-disable-line
    func:     Handler;        // eslint-disable-line

    static BEFORE   = x => x.action.indexOf(".before") !== -1;   // eslint-disable-line
    static PROGRESS = x => x.action.indexOf(".progress") !== -1;
    static CANCEL   = x => x.action.indexOf(".cancel") !== -1;   // eslint-disable-line
    static ERROR    = x => x.action.indexOf(".error") !== -1;    // eslint-disable-line
    static DONE     = x => (                                     // eslint-disable-line
        !Action.PROGRESS(x) &&
        !Action.CANCEL(x) &&
        !Action.BEFORE(x) &&
        !Action.ERROR(x)
    );

    static Handler(description: Action): Handler {
        return function(data?: Message): Promise<Cursor> { // eslint-disable-line
            if(!(this instanceof Cursor)) return Promise.reject(new InvalidCursorError(this, description));

            const message = data instanceof Message ? data : this.message;

            if(!Message.is(message))            return Promise.resolve(this
                .debug.trace(description.name, List(), this.action.state.type)
                .error(new UnknownMessageError(description.unit, description.name, message)));

            // hier das ganze in der message funktion mqchen
            try {
                //  Cursor promise aware machen, sodass
                //
                //  cursor
                //      .send.message
                //      .set()
                //      .send... geht
                //
                //  parallel:
                //
                //  cursor.send
                //      .message()
                //      .handle()
                //
                //  => das hängt im kern auch mit den computed props zusammen
                //
                // before():
                //
                // this
                //  .before(description, y)
                //  .send.guards()
                //
                return this.send.before(description, message)
                    .then(x => x.send.guards())
                    .then(x => !x.action.triggers ? x : x.send.triggers()
                        .then(cursor => cursor.send.delay(x.action instanceof PendingAction ? x.action.delay : 0).handle())
                        .then(cursor => cursor.send.after())
                        .catch(e => x.error(e)))
                    .catch(e => this
                        .debug.trace(description.name, List(), this.action.state.type)
                        .error(e));
            } catch(e) {
                return Promise.resolve(this
                    .debug.trace(description.name, List(), this.action.state.type)
                    .error(e));
            }
        };
    }

    static shouldWrap(key, op) { // eslint-disable-line
        return (
            (!op || !op.__Action) &&
            key !== "handle" &&
            key !== "after" &&
            key !== "error" &&
            key !== "done" &&
            key !== "finish" &&
            key !== "before" &&
            key !== "guards" &&
            key !== "triggers"
        );
    }

    constructor(unit: string | ActionInput, name?: string = "", declarativeTriggers?: List<Trigger> = List(), op: any = null) { // eslint-disable-line
        if(typeof unit !== "string") return Object.freeze(Object.assign(this, unit));

        const filtered = declarativeTriggers
            .filter(trigger => trigger.action.split(".")[0] === name);

        const triggers = filtered
            .filter(trigger => trigger.emits !== name);

        const ownTriggers = declarativeTriggers
            .filter(trigger => trigger.emits === name);

        const func = Action.shouldWrap(name, op) ? Action.Handler(this) : op;

        func.__Action = this;
        func.cancel   = Action.cancel.bind(this, func);

        const own = ownTriggers.find(x => x.action === name && x.emits === name);

        this.unit      = unit;
        this.name      = name;
        this.op        = op;
        this.before    = triggers.filter(Action.BEFORE);
        this.progress  = triggers.filter(Action.PROGRESS);
        this.cancel    = triggers.filter(Action.CANCEL);
        this.done      = triggers.filter(Action.DONE);
        this.error     = triggers.filter(Action.ERROR);
        this.func      = func;
        this.triggers  = ownTriggers
            .concat(own ? [] : [new Trigger(name, new DeclaredTrigger(name))]);

        Object.freeze(this);
    }

    setUnit(unit: string): Action {
        return new Action(Object.assign({}, this, { unit }));
    }

    willTrigger(cursor: Cursor, ...messages: Array<Message>): boolean { // eslint-disable-line
        // Test!!
        return List(messages).every(message => ( // eslint-disable-line
            (this.triggers.has(message.resource) && this.triggers.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.before.has(message.resource) && this.before.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.progress.has(message.resource) && this.progress.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.cancel.has(message.resource) && this.cancel.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.done.has(message.resource) && this.done.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.error.has(message.resource) && this.error.get(message.resource).shouldTrigger(cursor, message.payload))
        ));
    }

    guardsToJS(triggers: Array<{ guards: Array<Object> }>): Array<Object> {
        return triggers.map(x => Object.assign({}, x, {
            guards: x.guards.length
        }));
    }

    triggerFor(name: string): Trigger {
        const trimmed = name.replace(".done", "");
        const trigger = this.triggers.find(x => x.action === trimmed);

        return trigger || new Trigger(this.name, new DeclaredTrigger(this.name));
    }

    static cancel() {
        assert(false, "Action.cancel: implement!");
    }

    toJS(): Object {
        return {
            triggers: this.guardsToJS(this.triggers.toJS()),
            unit:     this.unit,
            name:     this.name,
            before:   this.guardsToJS(this.before.toJS()),
            progress: this.guardsToJS(this.progress.toJS()),
            cancel:   this.guardsToJS(this.cancel.toJS()),
            done:     this.guardsToJS(this.done.toJS()),
            error:    this.guardsToJS(this.error.toJS())
        };
    }
}

export default Action;
