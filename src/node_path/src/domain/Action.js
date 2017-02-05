import Immutable from "immutable";
import Cursor from "./Cursor";
import assert from "assert";
import Message from "../Message";
import UnknownMessageError from "./error/UnknownMessageError";
import { schedule } from "../Runloop";
import Trigger from "./Trigger";
import DeclaredTrigger from "./DeclaredTrigger";

class Action {
    static BEFORE = x => (
        !Action.PROGRESS(x) &&
        !Action.CANCEL(x) &&
        !Action.DONE(x) &&
        !Action.ERROR(x)
    );
    static PROGRESS = x => x.action.indexOf(".progress") !== -1;
    static CANCEL   = x => x.action.indexOf(".cancel") !== -1;   // eslint-disable-line
    static DONE     = x => x.action.indexOf(".done") !== -1;     // eslint-disable-line
    static ERROR    = x => x.action.indexOf(".error") !== -1;    // eslint-disable-line

    static Handler(description) {
        return function(y, prev = description.name) {
            const trigger = description.triggers.find(x => x.action === prev);

            try {
                if(!Message.is(y)) return Promise.resolve(this
                    .trace(description.name, Immutable.List(), trigger.guards.size)
                    .error(new UnknownMessageError(y)));

                const message = y.update("payload", payload => payload.concat(trigger.params));
                const tracing = this.trace(description.name, message.payload, trigger.guards.size);

                assert(this instanceof Cursor, `Invalid cursor of ${Object.getPrototypeOf(this)} for '${description.unit}[${description.name}.before]'.`);
                assert(this.isTracing, "cursor not tracing (before)");

                const x = trigger.shouldTrigger(tracing, message.payload);

                if(x.cursor.hasErrored) return Promise.resolve(x.cursor.trace.end());
                if(!x.result)           return Promise.resolve(x.cursor.trace.end());

                const triggered = x.cursor.trace.triggered();

                // TODO to test:
                //  - undefined return in action (sideeffect)
                //  - asynchronous action
                //  - error in action (return)
                //  - error in action (throw)
                //  - adync error in action (catch)
                //  - error in action guard
                //  - error in before guard
                //  - error in before
                //  - error in done
                //  - error in done guard
                //  - error in error guard
                //  - error in error handler
                //
                //  - more complex triggers (line in constr)
                return description
                    .applyBefore(triggered, y)
                    .then(cursor => description.applyAction(trigger, cursor, message))
                    .then(cursor => cursor.hasErrored ? description.applyError(cursor, message) : description.applyDone(cursor, message))
                    .then(cursor => cursor.hasErrored ? cursor.trace.end() : cursor.trace.error(cursor.currentError))
                    .catch(e => triggered.error(e));
            } catch(e) {
                return Promise.resolve(this.error(e));
            }
        };
    }

    constructor(unit, name, declarativeTriggers, op = null) { // eslint-disable-line
        const filtered = declarativeTriggers
            .filter(trigger => trigger.action.split(".")[0] === name);

        const triggers = filtered
            .filter(trigger => trigger.emits !== name);

        const ownTriggers = declarativeTriggers
            .filter(trigger => trigger.emits === name);

        const func = op && op.__Action ? op : Action.Handler(this);

        func.__Action = this;
        func.cancel   = this.cancel.bind(this, func);

        // hier müssen bei den ganzen triggern noch dopplungen gefiltert werden:
        // this.before.filter(x => //hat keiner der anderen den auch in before?)
        //
        // dadurch würde:
        //
        // test: message
        // test2: test message
        //
        // test: message
        // test2: test, sons würde das doppelt getriggert

        this.unit      = unit;
        this.name      = name;
        this.op        = op;
        this.before    = triggers.filter(Action.BEFORE);
        this.progress  = triggers.filter(Action.PROGRESS);
        this.cancel    = triggers.filter(Action.CANCEL);
        this.done      = triggers.filter(Action.DONE);
        this.error     = triggers.filter(Action.ERROR);
        this.func      = func;
        this.triggers  = ownTriggers.concat(ownTriggers.filter(x => x.action === name && x.emits === name).size === 1 ? [] : [new Trigger(name, new DeclaredTrigger(name))]);
    }

    willTrigger(cursor, ...messages) {
        // Test!!
        return Immutable.List(messages).every(message => ( // eslint-disable-line
            (this.triggers.has(message.resource) && this.triggers.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.before.has(message.resource) && this.before.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.progress.has(message.resource) && this.progress.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.cancel.has(message.resource) && this.cancel.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.done.has(message.resource) && this.done.get(message.resource).shouldTrigger(cursor, message.payload)) ||
            (this.error.has(message.resource) && this.error.get(message.resource).shouldTrigger(cursor, message.payload))
        ));
    }

    guardsToJS(triggers) {
        return triggers.map(x => Object.assign({}, x, {
            guards: x.guards.length
        }));
    }

    cancel() {
        assert(false, "Action.cancel: implement!");
    }

    applyBefore(cursor, message) {
        return this.applyTriggers("before", cursor, message);
    }

    applyDone(cursor, message) {
        return this.applyTriggers("done", cursor, message);
    }

    applyError(cursor, message) {
        return this.applyTriggers("error", cursor, message);
    }

    applyCancel(cursor, message) {
        return this.applyTriggers("cancel", cursor, message);
    }

    applyProgress(cursor, message) {
        return this.applyTriggers("progress", cursor, message);
    }

    applyTriggers(kind, cursor, message) {
        assert(cursor instanceof Cursor, `Invalid cursor of ${Object.getPrototypeOf(this)} for ''.`);

        const prev = this.name.concat(kind === "before" ? "" : `.${kind}`);

        const promise = Promise.all(this[kind]
            .map(x => cursor[x.emits] instanceof Function ? cursor[x.emits](message, prev) : cursor).toJS());

        return promise
            .then(x => x.reduce((dest, y) => {
                return Object.assign(dest, {
                    diffs:  dest.diffs.concat(cursor.diff(y)),
                    traces: dest.traces.concat(y.traces)
                });
            }, { diffs: Immutable.Set(), traces: Immutable.List() }))
            .then(({ diffs, traces }) => cursor
                .patch(diffs.toList(), traces));
    }

    applyAction(trigger, cursor, message) { // eslint-disable-line
        try {
            assert(cursor.isTracing, "cursor not tracing (before)");

            if(!this.op) return Promise.resolve(cursor);

            const result = schedule(this.op.bind(cursor, ...message.payload.toJS()), trigger.delay);

            assert((
                !result ||
                result instanceof Promise ||
                result instanceof Cursor ||
                result instanceof Error
            ), `Actions have to always return a cursor or undefined, got ${result && result instanceof Object ? result.constructor.name : result}`);

            if(result instanceof Error) return Promise.resolve(cursor.update("_unit", internals => internals.error(result)));

            return result instanceof Promise ? result : Promise.resolve(result || cursor);
        } catch(e) {
            return Promise.resolve(cursor.update("_unit", internals => internals.error(e)));
        }
    }

    toJS() {
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
