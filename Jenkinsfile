library 'pipeline-library'

timestamps {
  node('osx || linux') {
    stage('Checkout') {
      checkout scm
      def packageVersion = jsonParse(readFile('package.json'))['version']
      currentBuild.displayName = "#${packageVersion}-${currentBuild.number}"
    }

    nodejs(nodeJSInstallationName: 'node 6.9.5') {
      ansiColor('xterm') {
        stage('Build') {
          sh 'npm install'
        }

        stage('Test') {
          sh 'npm run-script coverage'
          junit 'junit_report.xml'
          // TODO Can we somehow consume the coverage report too?
          sh 'npm run-script clean'
        }

        stage('Package') {
          sh 'npm run-script dist'
          archiveArtifacts '*-commonjs-*.zip'
        }
      } // ansiColor
    } //nodejs
  } // node
} // timestamps
