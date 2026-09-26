
/**
 * Logging object
 */
class Logger { // eslint-disable-line no-unused-vars

    static get (module) {
        if (!Logger.instances[module]) {
            Logger.instances[module] = new Logger(module);
        }
        return Logger.instances[module];
    }

    /**
     * Object to log
     * @param {String} module Module name
     * @param {HTMLElement} [element] Where to log. If not provided, log into console
     */
    constructor (module, element) {
        this.module = module;
        this.element = element;
    }

    /**
     * @private
     * @param {String} type log type (log|warn|error)
     * @param {String} message Message to display
     */
    show (type, message) {
        const m = `${this.module}: ${message}`;
        if (this.element) {
            this.element.dataset.type = type;
            this.element.textContent = m;
        } else {
            console[type](m); // eslint-disable-line no-console
        }
    }

    /**
     * @param {String} message Message to log as info.
     */
    info (message) {this.show('log', message);}
    /**
     * @param {String} message Message to log as debug
     */
    debug (message) {this.show('log', message);}
    /**
     * @param {String} message Message to log as warning.
     */
    warn (message) {this.show('warn', message);}
    /**
     * @param {String} message Message to log as error.
     */
    error (message) {this.show('error', message);}
}

Logger.instances = {};
