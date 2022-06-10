const chalk = require('chalk')

const { identifyAccessToken } = require('../command-helpers/auth')
const { createCompiler } = require('../command-helpers/compiler')
const { fixParameters } = require('../command-helpers/gluegun')
const { createJsonRpcClient } = require('../command-helpers/jsonrpc')
const { validateNodeUrl } = require('../command-helpers/node')
const { withSpinner } = require('../command-helpers/spinner')
const { validateSubgraphName } = require('../command-helpers/subgraph')

const HELP = `
${chalk.bold('graph deploy')} [options] ${chalk.bold('<subgraph-name>')} ${chalk.bold(
  '[<subgraph-manifest>]',
)}

Options:

<<<<<<< HEAD
      --access-token <token>    Graph access token
  -g, --node <node>             Graph node to deploy the subgraph to
  -h, --help                    Show usage information
  -i, --ipfs <node>             Upload build results to an IPFS node
  -o, --output-dir <path>       Output directory for build results (default: build/)
      --skip-migrations         Skip subgraph migrations (default: false)
  -w, --watch                   Regenerate types when subgraph files change (default: false)
=======
        --product <subgraph-studio|hosted-service>
                                Selects the product to which to deploy
        --studio                  Shortcut for --product subgraph-studio
  -g,   --node <node>             Graph node to which to deploy
        --deploy-key <key>        User deploy key
  -l    --version-label <label>   Version label used for the deployment
  -h,   --help                    Show usage information
  -i,   --ipfs <node>             Upload build results to an IPFS node (default: ${DEFAULT_IPFS_URL})
  -hdr, --headers <map>           Add custom headers that will be used by the IPFS HTTP client (default: {})
        --debug-fork              ID of a remote subgraph whose store will be GraphQL queried
  -o,   --output-dir <path>       Output directory for build results (default: build/)
        --skip-migrations         Skip subgraph migrations (default: false)
  -w,   --watch                   Regenerate types when subgraph files change (default: false)
>>>>>>> 2d5943f (feat: add headers flag to the deploy command)
`

module.exports = {
  description: 'Deploys the subgraph to a Graph node',
  run: async toolbox => {
    // Obtain tools
    let { filesystem, print, system } = toolbox

    // Parse CLI parameters
    let {
      accessToken,
      g,
      h,
      i,
      help,
      ipfs,
      headers,
      hdr,
      node,
      o,
      outputDir,
      skipMigrations,
      w,
      watch,
    } = toolbox.parameters.options

    // Support both long and short option variants
    help = help || h
<<<<<<< HEAD
    ipfs = ipfs || i
=======
    ipfs = ipfs || i || DEFAULT_IPFS_URL
    headers = headers || hdr || {}
>>>>>>> 2d5943f (feat: add headers flag to the deploy command)
    node = node || g
    outputDir = outputDir || o
    watch = watch || w

    try {
      headers = JSON.parse(headers)
    } catch (e) {
      print.error("Please make sure headers is a valid JSON value")
      process.exitCode = 1
      return
    }

    let subgraphName, manifest
    try {
      ;[subgraphName, manifest] = fixParameters(toolbox.parameters, {
        h,
        help,
        w,
        watch,
      })
    } catch (e) {
      print.error(e.message)
      process.exitCode = 1
      return
    }

    // Fall back to default values for options / parameters
    outputDir = outputDir && outputDir !== '' ? outputDir : filesystem.path('build')
    manifest =
      manifest !== undefined && manifest !== ''
        ? manifest
        : filesystem.resolve('subgraph.yaml')

    // Show help text if requested
    if (help) {
      print.info(HELP)
      return
    }

    // Validate the subgraph name
    if (!subgraphName) {
      print.error('No subgraph name provided')
      print.info(HELP)
      process.exitCode = 1
      return
    }

    // Validate node
    if (!node) {
      print.error(`No Graph node provided`)
      print.info(HELP)
      process.exitCode = 1
      return
    }
    try {
      validateNodeUrl(node)
    } catch (e) {
      print.error(`Graph node "${node}" is invalid: ${e.message}`)
      process.exitCode = 1
      return
    }

    // Validate IPFS
    if (!ipfs) {
      print.error(`No IPFS node provided`)
      print.info(HELP)
      process.exitCode = 1
      return
    }

    let compiler = createCompiler(manifest, {
      ipfs,
      headers,
      outputDir,
      outputFormat: 'wasm',
      skipMigrations,
    })

    // Exit with an error code if the compiler couldn't be created
    if (!compiler) {
      process.exitCode = 1
      return
    }

    let hostedService = node.match(/thegraph.com/)
    let requestUrl = new URL(node)
    let client = createJsonRpcClient(requestUrl)

    // Exit with an error code if the client couldn't be created
    if (!client) {
      process.exitCode = 1
      return
    }

    // Use the access token, if one is set
    accessToken = await identifyAccessToken(node, accessToken)
    if (accessToken !== undefined && accessToken !== null) {
      client.options.headers = { Authorization: 'Bearer ' + accessToken }
    }

    let deploySubgraph = async ipfsHash => {
      let spinner = print.spin(`Deploying to Graph node ${requestUrl}`)
      //       `Failed to deploy to Graph node ${requestUrl}`,
      client.request(
        'subgraph_deploy',
        { name: subgraphName, ipfs_hash: ipfsHash },
        async (requestError, jsonRpcError, res) => {
          if (jsonRpcError) {
            spinner.fail(
              `Failed to deploy to Graph node ${requestUrl}: ${jsonRpcError.message}`,
            )

            // Provide helpful advice when the subgraph has not been created yet
            if (jsonRpcError.message.match(/subgraph name not found/)) {
              if (hostedService) {
                print.info(`
You may need to created it at https://thegraph.com/explorer/dashboard.`)
              } else {
                print.info(`
Make sure to create the subgraph first by running the following command:
$ graph create --node ${node} ${subgraphName}`)
              }
            }
            process.exitCode = 1
          } else if (requestError) {
            spinner.fail(`HTTP error deploying the subgraph ${requestError.code}`)
            process.exitCode = 1
          } else {
            spinner.stop()

            const base = requestUrl.protocol + '//' + requestUrl.hostname
            let playground = res.playground
            let queries = res.queries
            let subscriptions = res.subscriptions

            // Add a base URL if graph-node did not return the full URL
            if (playground.charAt(0) === ':') {
              playground = base + playground
            }
            if (queries.charAt(0) === ':') {
              queries = base + queries
            }
            if (subscriptions.charAt(0) === ':') {
              subscriptions = base + subscriptions
            }

            if (hostedService) {
              print.success(
                `Deployed to ${chalk.blue(
                  `https://thegraph.com/explorer/subgraph/${subgraphName}`,
                )}`,
              )
            } else {
              print.success(`Deployed to ${chalk.blue(`${playground}`)}`)
            }
            print.info('\nSubgraph endpoints:')
            print.info(`Queries (HTTP):     ${queries}`)
            print.info(`Subscriptions (WS): ${subscriptions}`)
            print.info(``)
          }
        },
      )
    }

    if (watch) {
      await compiler.watchAndCompile(async ipfsHash => {
        if (ipfsHash !== undefined) {
          await deploySubgraph(ipfsHash)
        }
      })
    } else {
      let result = await compiler.compile()
      if (result === undefined || result === false) {
        // Compilation failed, not deploying.
        process.exitCode = 1
        return
      }
      await deploySubgraph(result)
    }
  },
}
