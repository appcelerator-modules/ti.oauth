timestamps {
  node('osx || linux') {
    stage('Checkout') {
      checkout scm
    }

    nodejs(nodeJSInstallationName: 'node 6.9.5') {
      stage('Build') {
        sh 'npm install'
      }

      stage('Test') {
        sh 'npm run-script coverage'
        // TODO Can we generate a report that JUnit plugin or XUnit can handle?
        sh 'npm run-script clean'
      }

      stage('Package') {
        sh 'npm run-script dist'
        archiveArtifacts '*-commonjs-*.zip'
      }
    }
  }
}
