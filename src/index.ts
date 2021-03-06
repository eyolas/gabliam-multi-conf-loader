import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as d from 'debug';
import { promisify, inspect } from 'util';
import { configResolver, Resolver } from '@gabliam/core';

// Promisify
const glob = promisify(require('glob')); // require and no import for typings bug
const readFile = promisify(fs.readFile);

const debug = d('gabliam-multi-conf-loader:FileLoader');

async function loadConstant(
  folder: string,
  projectName: string,
  resolver: Resolver,
  profile?: string
) {
  const files: string[] = await glob(`**/constants?(-+([a-zA-Z])).@(yml)`, {
    cwd: folder
  });

  let constants: object = {};

  if (!files || files.length === 0) {
    return constants;
  }

  const defaultProfileFile = files.find(file => file === `constants.yml`);
  if (defaultProfileFile) {
    constants = _.merge(
      {},
      constants,
      await loadFile(`${folder}/${defaultProfileFile}`, resolver)
    );
  }

  if (profile) {
    const profileFile = files.find(file => file === `constants-${profile}.yml`);

    if (profileFile) {
      constants = _.merge(
        {},
        constants,
        await loadFile(`${folder}/${profileFile}`, resolver)
      );
    }
  }
  return constants;
}

/**
 * FileLoader
 */
export default async function FileLoader(
  { folder, projectName }: { folder: string; projectName: string },
  profile?: string
) {
  debug('loadConfig', folder);
  const resolver = configResolver(folder);
  const constants = await loadConstant(folder, projectName, resolver, profile);

  // create tag config
  const ConfigYamlType = new yaml.Type('!config', {
    kind: 'scalar',
    construct: function(data) {
      return _.get(constants, data, {});
    },
    instanceOf: Object
  });

  const VGO_SCHEMA = yaml.Schema.create([ConfigYamlType]);

  const files: string[] = await glob(`**/application?(-+([a-zA-Z])).@(yml)`, {
    cwd: folder
  });

  let config: object = {};

  if (!files || files.length === 0) {
    return config;
  }

  const defaultProfileFile = files.find(file => file === `application.yml`);
  if (defaultProfileFile) {
    config = _.merge(
      {},
      config,
      await loadConfigProject(
        `${folder}/${defaultProfileFile}`,
        projectName,
        VGO_SCHEMA,
        resolver
      )
    );
  }

  if (profile) {
    const profileFile = files.find(
      file => file === `application-${profile}.yml`
    );

    if (profileFile) {
      config = _.merge(
        {},
        config,
        await loadConfigProject(
          `${folder}/${profileFile}`,
          projectName,
          VGO_SCHEMA,
          resolver
        )
      );
    }
  }
  debug('loadedConfig', inspect(config, { depth: null }));
  return config;
}

async function loadConfigProject(
  filePath: string,
  projectName: string,
  schema: yaml.Schema,
  resolver: Resolver
) {
  const data = await readFile(filePath, 'utf8');
  try {
    const vals = yaml.loadAll(data, undefined, { schema }) || [];
    return await resolver(_.find(vals, { projectName }) || {});
  } catch (e) {
    return {};
  }
}

async function loadFile(filePath: string, resolver: Resolver): Promise<Object> {
  const data = await readFile(filePath, 'utf8');
  try {
    return await resolver(yaml.load(data) || {});
  } catch (e) {
    return {};
  }
}
