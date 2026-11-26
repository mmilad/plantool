# Plan (`plantool`)

Plan is a Git-native planning tool for projects and coding agents. It stores goals, tickets and their relationships in a `.plan/` folder in your repository, so project data can be reviewed and shared with Git.

## Install

Plan requires Node.js 22 or newer. Install the command globally with npm:

```sh
npm install --global @mmilad/plantool
```

Check that it is available:

```sh
plantool --version
```

## Use it in a project

From your project directory, initialize Plan once:

```sh
plantool init --name "My project"
```

This creates `.plan/` with the project's planning data. Commit that folder to Git to share the plan with your team.

Create and view tickets. New feature tickets start in `in_planning`; move one to `todo` when its behavior, scope and acceptance criteria are ready for implementation:

```sh
plantool ticket create --title "Build the first feature"
plantool ticket create --kind feature --title "Add sign-in"
plantool ticket update MY-2 --status todo
plantool ticket list
plantool tree
```

Plan can also help an agent choose and complete work:

```sh
plantool next
plantool claim MY-1 --agent my-agent
plantool done MY-1 --note "Implemented the feature" --verified "Checks passed"
```

Replace `MY-1` with the ticket key shown by `plantool ticket list` or `plantool tree`.
`plantool next` lists ready `todo` tickets and never returns features still in planning. Review those with `plantool ticket list --status in_planning`. For an existing project created before `in_planning` was added, run `plantool status add in_planning` once; existing tickets keep their current statuses.

Start the local web interface with:

```sh
plantool serve
```

In the ticket view, search by title, ticket key or UUID to find parents and child tickets. Ticket fields save when you change a selection or leave an edited field. Add a reusable checklist as a `checklist:<name>` label; its checks appear on the ticket, where each can be ticked directly. Add ticket-specific checks under **Individual checks**.

For all available commands, run `plantool --help`. For an introduction to the planning workflow, run `plantool agent onboard`.
