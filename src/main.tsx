#!/usr/bin/env node

import { program } from "commander";
import React from "react";
import { render } from "ink";
import { Punchdeck, PunchdeckProps, PunchdeckPane } from "./punchdeck.js";
import untildify from "untildify";
import yaml from "js-yaml";
import fs from "fs";
import { execa, ExecaChildProcess } from "execa";

export interface PunchdeckCommand {
  commandline: string;
  title?: string;
}

export interface PunchdeckConfig {
  commands?: PunchdeckCommand[];
}

export function loadConfig(configFile: string): PunchdeckConfig {
  const fullPath = untildify(configFile);
  if (!fs.existsSync(fullPath)) {
    return {};
  }
  const config = yaml.load(
    fs.readFileSync(fullPath, "utf8")
  ) as PunchdeckConfig;
  return config;
}

function runCommand(commandline: string): ExecaChildProcess {
  console.log("Running: " + commandline);
  const [argv0, ...args] = commandline.split(" ");

  return execa(argv0, args, { all: true, encoding: "utf8" });
}

program
  .name("punchdeck")
  .version("0.0.1")
  .description("Run multiple processes in a terminal window.")
  .argument("[config]", "Path to config file", "punchdeck.yaml")
  .action(async (config?: string) => {
    const configPath = config ?? "punchdeck.yaml";
    const configData = loadConfig(configPath);
    const panes: PunchdeckPane[] = [];
    for (const command of configData.commands ?? []) {
      console.log(`Starting command: ${command.commandline}`);
      const subproc = runCommand(command.commandline);
      console.log(`Started: ${command.commandline}`);
      const waitForSpawn = new Promise<void>((resolve, reject) => {
        subproc.on('spawn', () => {
            console.log(`Spawned: ${command.commandline}`);
            resolve();
        });
      });
      console.log(`Waiting for spawn: ${command.commandline}`);
      await waitForSpawn;
      console.log(`Finished spawn: ${command.commandline}`);
      panes.push({
        title: command.title ?? command.commandline,
        stream: subproc.all!
      });
    }
    render(<Punchdeck panes={panes} maxHistory={1000} />);
  });

program.parse(process.argv);
