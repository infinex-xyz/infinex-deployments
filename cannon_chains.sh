#!/opt/local/bin/bash

# This script is used for running cannon commands on multiple chains.

# Mapping of chain names to chain IDs
declare -A CHAIN_NAME_TO_ID=(
    ["arbitrum"]="42161"
    ["base"]="8453"
    ["ethereum"]="1"
    ["optimism"]="10"
    ["polygon"]="137"
    ["arbitrum-sepolia"]="421614"
    ["base-sepolia"]="84532"
    ["ethereum-sepolia"]="11155111"
    ["optimism-sepolia"]="11155420"
    ["polygon-amoy"]="80002"
    # Add other chain mappings as needed
)

# Function to display usage instructions
usage() {
    echo "Usage: $0 [-e | --env <environment>] [--chain-ids <chain_id1,chain_id2,...>] [--chain-names <chain_name1,chain_name2,...>] <command>"
    echo
    echo "This script allows you to run cannon commands across multiple blockchain environments."
    echo
    echo "1. Minimal Usage with --env:"
    echo "   You can specify the environment using the --env flag. This will automatically run the command for all predefined chains in that environment."
    echo "   - Example:"
    echo "     ./cannon_chains.sh \"pnpm cannon build deployments/account-factory/infinex-account-factory.toml --dry-run --chain-id CHAIN_ID\" --env testnet"
    echo "   - This will run the command for all testnet chains."
    echo
    echo "2. Custom Chain Names:"
    echo "   If you want to target specific chains, you can provide chain names using the --chain-names flag."
    echo "   - Chain names should match the keys in the CHAIN_NAME_TO_ID mapping."
    echo "   - For testnet chains, the names follow the pattern <mainnet-chain-name>-<testnet-name>."
    echo "   - Example:"
    echo "     ./cannon_chains.sh \"pnpm cannon build deployments/account-factory/infinex-account-factory.toml --dry-run --chain-id CHAIN_ID\" --chain-names ethereum base --env mainnet"
    echo "   - This will run the command for Ethereum and Base chains on mainnet."
    echo
    echo "3. Custom Chain IDs:"
    echo "   You can also specify custom chain IDs directly using the --chain-ids flag."
    echo "   - Example:"
    echo "     ./cannon_chains.sh \"pnpm cannon build deployments/account-factory/infinex-account-factory.toml --dry-run --chain-id CHAIN_ID\" --chain-ids 1 8453"
    echo "   - This will run the command for the specified chain IDs directly."
    echo
    echo "4. Automatic API Key and Private Key Substitution:"
    echo "   The script automatically substitutes API_KEY and PRIVATE_KEY placeholders in the command with values from .env.secrets."
    echo "   - API keys are expected to be stored in the .env.secrets file as VERIFY_API_KEY_<CHAIN_NAME>."
    echo "   - PRIVATE_KEY should be stored as PRIVATE_KEY in the .env.secrets file."
    echo "   - Example:"
    echo "     ./cannon_chains.sh \"pnpm cannon verify infinex-core:latest@core --chain-id CHAIN_ID --api-key API_KEY --private-key PRIVATE_KEY\" --env testnet"
    echo "   - This will automatically insert the chain ID, API key, and private key into the command."
    echo
    echo "5. Full Command Customization:"
    echo "   If you want full control over the command, you can provide a custom command string, with placeholders for CHAIN_ID and CHAIN_NAME."
    echo "   - The script will replace these placeholders with the appropriate values for each chain."
    echo "   - Example:"
    echo "     ./cannon_chains.sh \"pnpm cannon build infinex-omnibus/testnets/infinex-omnibus-test.CHAIN_NAME.toml --chain-id CHAIN_ID --dry-run\" --env testnet"
    echo "   - This will build the specified TOML file for each chain in the testnet environment."
    echo
    echo "6. Combining Options:"
    echo "   You can combine the options to target specific chains or environments."
    echo "   - Example:"
    echo "     ./cannon_chains.sh \"pnpm cannon verify infinex-core-test:1.0.0@core --chain-id CHAIN_ID --api-key API_KEY\" --chain-names ethereum-sepolia base-sepolia"
    echo "   - This will run the verification command for the specified testnet chains only."
    echo
    echo "7. Help:"
    echo "   If you're unsure how to use the script, simply run:"
    echo "     $0"
    echo "   - This will display these usage instructions."
    exit 1
}

# Initialize variables
ENVIRONMENT=""
CUSTOM_CHAIN_IDS=()
CUSTOM_CHAIN_NAMES=()
VERIFY_FLAG=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --chain-ids)
            shift
            while [[ $# -gt 0 && ! "$1" =~ ^- ]]; do
                CUSTOM_CHAIN_IDS+=("$1")
                shift
            done
            ;;
        --chain-names)
            shift
            while [[ $# -gt 0 && ! "$1" =~ ^- ]]; do
                CUSTOM_CHAIN_NAMES+=("$1")
                shift
            done
            ;;
        *)
            COMMAND+="$1 "
            shift
            ;;
    esac
done

# Trim the trailing space from COMMAND
COMMAND=$(echo "$COMMAND" | sed 's/[[:space:]]*$//')

# Check if the command was provided
if [ -z "$COMMAND" ] && [ "$VERIFY_FLAG" = false ]; then
    echo "Error: No command provided."
    exit 1
fi

# Convert chain names to chain IDs and store names
CHAIN_NAMES=()
CHAIN_IDS=()
for CHAIN_NAME in "${CUSTOM_CHAIN_NAMES[@]}"; do
    if [[ -n "${CHAIN_NAME_TO_ID[$CHAIN_NAME]}" ]]; then
        CHAIN_IDS+=("${CHAIN_NAME_TO_ID[$CHAIN_NAME]}")
        CHAIN_NAMES+=("$CHAIN_NAME")
    else
        echo "Error: Unknown chain name '$CHAIN_NAME'"
        exit 1
    fi
done

# Combine with custom chain IDs
CHAIN_IDS+=("${CUSTOM_CHAIN_IDS[@]}")

# Select the appropriate list of chain IDs based on the environment
if [ ${#CHAIN_IDS[@]} -eq 0 ] && [ -n "$ENVIRONMENT" ]; then
    case $ENVIRONMENT in
        testnet)
            CHAIN_IDS=("421614" "84532" "11155111" "11155420" "80002")
            CHAIN_NAMES=("arbitrum-sepolia" "base-sepolia" "ethereum-sepolia" "optimism-sepolia" "polygon-amoy") 
            ;;
        mainnet)
            CHAIN_IDS=("42161" "8453" "1" "10" "137")
            CHAIN_NAMES=("arbitrum" "base" "ethereum" "optimism" "polygon")
            ;;
        *)
            echo "Error: Unknown environment '$ENVIRONMENT'"
            exit 1
            ;;
    esac
fi

# Function to map testnet chain names to their mainnet equivalents
map_testnet_to_mainnet() {
    local chain_name="$1"
    if [[ "$ENVIRONMENT" == "testnet" ]]; then
        echo "${chain_name%-*}"
    else
        echo "$chain_name"
    fi
}

# Check for secrets file and load it
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "Error: .env file not found."
    exit 1
fi

# Ensure compatibility for associative arrays
if [[ ${BASH_VERSINFO:-0} -lt 4 ]]; then
    echo "Error: This script requires Bash 4.0 or later."
    exit 1
fi

# Loop through each chain ID and execute the command
for i in "${!CHAIN_IDS[@]}"; do
    CHAIN_ID=${CHAIN_IDS[$i]}
    CHAIN_NAME=${CHAIN_NAMES[$i]}

    # Replace the placeholders "CHAIN_ID" and "CHAIN_NAME" in the command with the actual chain ID and name
    FINAL_COMMAND="${COMMAND//CHAIN_ID/$CHAIN_ID}"
    FINAL_COMMAND="${FINAL_COMMAND//CHAIN_NAME/$CHAIN_NAME}"

    # Initialize variables for redaction
    API_KEY_REDACTION=""
    PRIVATE_KEY_REDACTION=""

    # Check if the API_KEY placeholder exists in the command
    if [[ "$FINAL_COMMAND" == *"API_KEY"* ]]; then
        # Map testnet chain names to mainnet equivalents
        MAINNET_CHAIN_NAME=$(map_testnet_to_mainnet "$CHAIN_NAME")

        # Extract the API key from the environment variables using the mapped mainnet chain name
        API_KEY_VAR="VERIFY_API_KEY_$(echo "$MAINNET_CHAIN_NAME" | tr '[:lower:]' '[:upper:]')"
        API_KEY="${!API_KEY_VAR}"
        
        if [ -z "$API_KEY" ]; then
            echo "Error: API key for chain $MAINNET_CHAIN_NAME not found."
            exit 1
        fi

        # Substitute API_KEY in the command
        FINAL_COMMAND="${FINAL_COMMAND//API_KEY/$API_KEY}"
        API_KEY_REDACTION="$API_KEY"
    fi
    
    # Check if the PRIVATE_KEY placeholder exists in the command
    if [[ "$FINAL_COMMAND" == *"PRIVATE_KEY"* ]]; then
        # Extract the private key from the environment variables
        PRIVATE_KEY="${PRIVATE_KEY:-}"
        
        if [ -z "$PRIVATE_KEY" ]; then
            echo "Error: PRIVATE_KEY not found in .env.secrets."
            exit 1
        fi

        # Substitute PRIVATE_KEY in the command
        FINAL_COMMAND="${FINAL_COMMAND//PRIVATE_KEY/$PRIVATE_KEY}"
        PRIVATE_KEY_REDACTION="$PRIVATE_KEY"
    fi
    
    # Redact API key and private key in the output, only if they were substituted
    REDACTED_COMMAND="$FINAL_COMMAND"
    if [[ -n "$API_KEY_REDACTION" ]]; then
        REDACTED_COMMAND=$(echo "$REDACTED_COMMAND" | sed "s/$API_KEY_REDACTION/***************/g")
    fi
    if [[ -n "$PRIVATE_KEY_REDACTION" ]]; then
        REDACTED_COMMAND=$(echo "$REDACTED_COMMAND" | sed -E 's/--private-key [^ ]+/--private-key ***************/g')
    fi
    
    echo "Executing \"$REDACTED_COMMAND\""  # Debug output
    # Execute the command
    eval "$FINAL_COMMAND"
done
