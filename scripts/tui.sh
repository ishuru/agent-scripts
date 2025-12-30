#!/usr/bin/env bash

#
# Agent Scripts TUI Dashboard
#
# A pure bash terminal UI for managing agent-scripts helpers.
#
# Usage: ./scripts/tui.sh
#

set -eo pipefail

# Colors
c_reset='\033[0m'
c_bold='\033[1m'
c_dim='\033[2m'
c_bg_blue='\033[44m'
c_bg_gray='\033[47m'
c_fg_black='\033[30m'
c_fg_white='\033[37m'
c_fg_cyan='\033[36m'
c_fg_green='\033[32m'
c_fg_yellow='\033[33m'
c_fg_red='\033[31m'
c_fg_gray='\033[90m'

# Helpers
helpers=(
  "1:Consistency Checker:./scripts/check-consistency"
  "2:Git Sync:./scripts/git-sync --dry-run"
  "3:Doc Validator:npx tsx scripts/doc-validator.ts"
  "4:Safe Op:npx tsx scripts/safe-op.ts list"
  "5:Test Suite:./scripts/test-helpers.sh"
  "6:Pre-Commit:./scripts/pre-commit.sh"
  "7:Run All Checks:__all__"
)

# State
selected=0
running=""
declare -a results
declare -a output_lines

# Get terminal size
get_size() {
  width=$(tput cols 2>/dev/null || echo 80)
  height=$(tput lines 2>/dev/null || echo 24)
}

# Clear screen
clear_screen() {
  printf '\033[2J\033[H'
}

# Hide/show cursor
hide_cursor() { printf '\033[?25l'; }
show_cursor() { printf '\033[?25h'; }

# Render header
render_header() {
  local title="${c_bold}Agent Scripts Dashboard${c_reset}"
  local subtitle="${c_dim}Helper utilities - Use arrow keys to navigate, Enter to run, q to quit${c_reset}"

  printf "${c_bg_blue}${c_fg_black}  %*s  ${c_reset}\n" "$((width - 4))"
  printf "${c_bg_blue}${c_fg_black}  %s%*s  ${c_reset}\n" "$title" "$((width - ${#title} - 4))"
  printf "${c_bg_blue}${c_fg_black}  %s%*s  ${c_reset}\n" "$subtitle" "$((width - ${#subtitle} - 4))"
  printf "${c_bg_blue}${c_fg_black}  %*s  ${c_reset}\n" "$((width - 4))"
}

# Render helpers
render_helpers() {
  printf "\n${c_bold}  Helpers${c_reset}\n"
  printf "  %s\n" "─$(printf '─%.0s' $(seq 1 $((width - 6))))"

  for i in "${!helpers[@]}"; do
    IFS=: read -r key name cmd <<< "${helpers[$i]}"
    local is_selected=$((i == selected))
    local is_running=""
    local result="${results[$i]:-}"

    if [[ "$running" == "$i" ]]; then
      is_running="${c_fg_cyan}⟳ Running...${c_reset}"
    elif [[ "$result" == "ok" ]]; then
      is_running="${c_fg_green}✓${c_reset}"
    elif [[ "$result" == "error" ]]; then
      is_running="${c_fg_red}✗${c_reset}"
    fi

    if [[ $is_selected -eq 1 ]]; then
      printf "${c_bg_blue}${c_fg_cyan} ▶ [${key}] ${name}%*s ${c_reset}" "$((width - ${#name} - 12))"
    else
      printf "   [${key}] ${c_dim}${name}${c_reset}"
    fi

    if [[ -n "$is_running" ]]; then
      printf "%*b%s" "$((width - ${#name} - 20))" "" "$is_running"
    fi
    printf "\n"
  done
}

# Render output
render_output() {
  printf "\n${c_bold}  Output${c_reset}\n"
  printf "  %s\n" "─$(printf '─%.0s' $(seq 1 $((width - 6))))"

  if [[ ${#output_lines[@]} -eq 0 ]]; then
    printf "  ${c_dim}Run a helper to see output...${c_reset}\n"
  else
    for line in "${output_lines[@]: -10}"; do
      printf "  %s\n" "$line"
    done
  fi
}

# Render status bar
render_status() {
  local passed=0 errors=0
  for r in "${results[@]}"; do
    [[ "$r" == "ok" ]] && ((passed++))
    [[ "$r" == "error" ]] && ((errors++))
  done

  local stats="${c_bold}Helpers:${c_reset} ${#helpers[@]}  │  ${c_fg_green}Passed:${c_reset} $passed  │  ${c_fg_red}Errors:${c_reset} $errors  │  ${c_dim}Press q to quit, r to refresh${c_reset}"

  printf "\n${c_bg_gray}${c_fg_black}  %s%*s  ${c_reset}\n" "$stats" "$((width - ${#stats} - 4))"
}

# Main render
render() {
  clear_screen
  get_size
  render_header
  render_helpers
  render_output
  render_status
}

# Run helper
run_helper() {
  local helper="${helpers[$1]}"
  IFS=: read -r key name cmd <<< "$helper"

  if [[ "$cmd" == "__all__" ]]; then
    output_lines+=("Running all helpers...")
    render
    for i in "${!helpers[@]}"; do
      IFS=: read -r k n c <<< "${helpers[$i]}"
      if [[ "$c" != "__all__" ]]; then
        running="$i"
        render
        output_lines+=("$ $c")
        if eval "$c" >/dev/null 2>&1; then
          results[$i]="ok"
          output_lines+=("${c_fg_green}✓ Success${c_reset}")
        else
          results[$i]="error"
          output_lines+=("${c_fg_red}✗ Failed${c_reset}")
        fi
        running=""
        render
        sleep 0.5
      fi
    done
  else
    running="$1"
    render
    output_lines+=("")
    output_lines+=("$ $cmd")

    local output
    if output=$(eval "$cmd" 2>&1); then
      results[$1]="ok"
      while IFS= read -r line; do
        output_lines+=("$line")
      done <<< "$output"
      output_lines+=("${c_fg_green}✓ Exit code: 0${c_reset}")
    else
      results[$1]="error"
      while IFS= read -r line; do
        output_lines+=("$line")
      done <<< "$output"
      output_lines+=("${c_fg_red}✗ Exit code: $?${c_reset}")
    fi
    running=""
  fi
}

# Main loop
main() {
  clear_screen
  hide_cursor

  # Setup terminal
  stty -echo 2>/dev/null || true
  trap 'show_cursor; stty echo 2>/dev/null || true; clear_screen; exit' EXIT INT

  render

  # Read input
  local IFS=''
  while true; do
    local key
    read -rsn1 key 2>/dev/null || break

    case "$key" in
      q) show_cursor; clear_screen; exit 0 ;;
      r) results=(); output_lines=(); render ;;
      $'\x1b')  # Arrow keys
        read -rsn2 -t 0.1 key 2>/dev/null || true
        case "$key" in
          '[A') selected=$(( (selected - 1 + ${#helpers[@]}) % ${#helpers[@]} )); render ;;
          '[B') selected=$(( (selected + 1) % ${#helpers[@]} )); render ;;
        esac
        ;;
      $'')  # Enter
        run_helper "$selected"
        render
        ;;
      [1-7])
        selected=$((key - 1))
        run_helper "$selected"
        render
        ;;
    esac
  done
}

main
