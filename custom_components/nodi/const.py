DOMAIN = "nodi"

CONF_HOST = "host"
CONF_PORT = "port"
CONF_USERNAME = "username"
CONF_PASSWORD = "password"
CONF_LEARN_TIMEOUT = "learn_timeout"

DEFAULT_PORT = 80
DEFAULT_LEARN_TIMEOUT = 90
DEFAULT_TRAVEL_TIME = 25

STORAGE_KEY = f"{DOMAIN}.codes"
STORAGE_VERSION = 1

ACTION_TO_DIRECTION = {
    "open": "up",
    "close": "down",
    "stop": "stop",
}

DIRECTIONS = ("up", "down", "stop")
