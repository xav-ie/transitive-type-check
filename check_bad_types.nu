# Extract entry points from package.json
let $tsconfig_check = "tsconfig-check.json"
let pkg = open package.json
let entries = [$pkg.main?, $pkg.module?] | compact | uniq

let files_to_trace = if ($entries | is-empty) {
 input "No main/module found in package.json. Enter files to trace (comma-separated): "
 | split row ","
} else {
 print $"Found entry points: ($entries | str join ', ')"
 $entries
}
let trace_config = {
  extends: ((pwd) | path join "tsconfig.json"),
  include: $files_to_trace
}

$trace_config | to json | save -f $tsconfig_check

try {
  let bad_deps = (npx tsc --listFiles --noEmit --project $tsconfig_check
  | lines
  | path dirname
  | uniq
  | each {||
    mut dir = $in
    while (not ($dir | path join "package.json" | path exists)) and ($dir != "/") {
      $dir = ($dir | path dirname)
    }
    if ($dir | path join "package.json" | path exists) {
      $dir
    } else {
      null
    }
  }
  | uniq
  | str replace --regex '^.*/node_modules/' ''
  | filter {||
    let peerDeps = ($pkg | get peerDependencies? | default {} | columns)
    let deps = ($pkg | get dependencies? | default {} | columns)
    let devDeps = ($pkg | get devDependencies? | default {} | columns)
    ($in not-in $peerDeps) and ($in not-in $deps) and ($in in $devDeps)
  }
  | filter {||
    if ($in | str starts-with "@types/") {
      # Extract the base package name from @types/foo -> foo
      let base_pkg = ($in | str replace "@types/" "" | str replace "__" "/")
      let deps = ($pkg | get dependencies? | default {} | columns)
      let devDeps = ($pkg | get devDependencies? | default {} | columns)
      # Only flag @types packages if the base package is in dependencies
      $base_pkg in $deps or $"@($base_pkg)" in $deps
    } else {
      true
    }
  }
  | filter {|| $in != "typescript" })

  print ([
    "Consider moving these " (ansi teal) "devDependencies" (ansi reset)
    " into " (ansi teal) "dependencies" (ansi reset) " or " (ansi teal)
    "peerDependencies" (ansi reset) ". " (ansi yellow)
    "\nNot doing so will likely result in bad exported types."
    (ansi reset)
  ] | str join "")
  print $bad_deps
}

rm -f $tsconfig_check
